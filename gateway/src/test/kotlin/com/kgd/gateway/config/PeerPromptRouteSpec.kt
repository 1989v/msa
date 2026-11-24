package com.kgd.gateway.config

import com.kgd.common.security.JwtUtil
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.route.Route
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR
import org.springframework.core.annotation.AnnotationAwareOrderComparator
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.time.Duration

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = ["spring.data.redis.host=localhost", "spring.data.redis.port=16379"],
)
class PeerPromptRouteSpec(
    @Autowired private val routeLocator: RouteLocator,
    @Autowired private val jwt: JwtUtil,
) : BehaviorSpec({
    val routes = routeLocator.routes.collectList().block().orEmpty()
    fun routeFor(path: String): Route {
        val exchange = MockServerWebExchange.from(MockServerHttpRequest.get("https://rank.1989v.com$path"))
        return routes.first { Mono.from(it.predicate.apply(exchange)).block() == true }
    }
    fun forward(route: Route, exchange: MockServerWebExchange): ServerWebExchange? {
        exchange.attributes[GATEWAY_ROUTE_ATTR] = route
        val filters = route.filters.sortedWith(AnnotationAwareOrderComparator.INSTANCE)
        var forwarded: ServerWebExchange? = null
        fun chain(i: Int): GatewayFilterChain = GatewayFilterChain { ex ->
            if (i == filters.size) { forwarded = ex; Mono.empty() } else filters[i].filter(ex, chain(i + 1))
        }
        chain(0).filter(exchange).block(Duration.ofSeconds(20))
        return forwarded
    }
    Given("peer prompt API routing") {
        Then("public reads and member mutations reach content via the dedicated routes") {
            listOf("/api/v1/blog/peer-prompts", "/api/v1/blog/peer-prompts/7").forEach {
                routeFor(it).id shouldBe "blog-peer-public"
                routeFor(it).uri.toString() shouldBe "http://content:8097"
            }
            listOf("/api/v1/blog/me/peer-prompts", "/api/v1/blog/me/peer-prompts/7/review", "/api/v1/blog/me/peer-prompts/7/reviews/3").forEach {
                routeFor(it).id shouldBe "blog-peer-write"
            }
        }
        Then("anonymous reads strip forged member and admin identity") {
            val ex = MockServerWebExchange.from(MockServerHttpRequest.get("https://rank.1989v.com/api/v1/blog/peer-prompts/7")
                .header("X-User-Id", "1").header("X-User-Roles", "ROLE_ADMIN"))
            val outgoing = forward(routeFor("/api/v1/blog/peer-prompts/7"), ex)!!
            outgoing.request.headers.getFirst("X-User-Id") shouldBe null
            outgoing.request.headers.getFirst("X-User-Roles") shouldBe null
        }
        Then("authenticated reads identify the real member for ownership and their older review") {
            val token = jwt.generateAccessToken("42", listOf("ROLE_USER"))
            val ex = MockServerWebExchange.from(MockServerHttpRequest.get("https://rank.1989v.com/api/v1/blog/peer-prompts/7")
                .header(HttpHeaders.AUTHORIZATION, "Bearer $token").header("X-User-Id", "1").header("X-User-Roles", "ROLE_ADMIN"))
            val outgoing = forward(routeFor("/api/v1/blog/peer-prompts/7"), ex)!!
            outgoing.request.headers.getFirst("X-User-Id") shouldBe "42"
            outgoing.request.headers.getFirst("X-User-Roles") shouldBe "ROLE_USER"
        }
        Then("anonymous writes cannot use forged identity") {
            val ex = MockServerWebExchange.from(MockServerHttpRequest.post("https://rank.1989v.com/api/v1/blog/me/peer-prompts")
                .header("X-User-Id", "1").header("X-User-Roles", "ROLE_ADMIN"))
            forward(routeFor("/api/v1/blog/me/peer-prompts"), ex) shouldBe null
            ex.response.statusCode shouldBe HttpStatus.UNAUTHORIZED
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)
}
