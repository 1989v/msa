package com.kgd.gateway.config

import com.kgd.common.security.JwtUtil
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.route.Route
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR
import org.springframework.core.annotation.AnnotationAwareOrderComparator
import org.springframework.core.env.Environment
import org.springframework.http.HttpHeaders
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.test.web.reactive.server.WebTestClient
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.time.Duration

/**
 * 광고 라우트의 경계를 고정한다.
 *
 * 판정 근거는 게이트웨이가 실제로 쓰는 라우트 표다 — 요청 하나를 만들어 라우트 표를 선언 순서대로
 * 훑고 **처음 맞는 라우트**를 본다(`RoutePredicateHandlerMapping` 과 같은 규칙). 백엔드까지 가지 않고
 * 끝나는 응답(404·401·403)은 실제 HTTP 로 확인한다.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.data.redis.host=localhost",
        "spring.data.redis.port=16379",
        "kgd.gateway.ads.allowed-hosts=1989v.com, blog.1989v.com, localhost",
        "logging.level.org.springframework.cloud.gateway=INFO",
    ],
)
class AdsRouteSpec(
    @Autowired private val env: Environment,
    @Autowired private val routeLocator: RouteLocator,
    @Autowired private val jwtUtil: JwtUtil,
) : BehaviorSpec({

    val client = WebTestClient
        .bindToServer()
        .baseUrl("http://localhost:${env.getRequiredProperty("local.server.port")}")
        .responseTimeout(Duration.ofSeconds(20))
        .build()

    val routes: List<Route> = routeLocator.routes.collectList().block().orEmpty()

    fun request(path: String, host: String, configure: MockServerHttpRequest.BaseBuilder<*>.() -> Unit = {}) =
        MockServerHttpRequest.post("http://$host$path")
            .header(HttpHeaders.HOST, host)
            .apply(configure)
            .build()

    /** 게이트웨이가 이 요청에 고를 라우트 — 선언 순서대로 처음 맞는 것 */
    fun firstMatch(path: String, host: String): String? {
        val exchange = MockServerWebExchange.from(request(path, host))
        return routes.firstOrNull { Mono.from(it.predicate.apply(exchange)).block() == true }?.id
    }

    /** 라우트의 필터를 순서대로 돌리고, 백엔드로 나갈 요청을 잡는다 */
    fun forwardedRequest(routeId: String, exchange: MockServerWebExchange): ServerWebExchange? {
        val route = routes.first { it.id == routeId }
        exchange.attributes[GATEWAY_ROUTE_ATTR] = route
        val filters = route.filters.sortedWith(AnnotationAwareOrderComparator.INSTANCE)
        var forwarded: ServerWebExchange? = null
        fun chainAt(i: Int): GatewayFilterChain = GatewayFilterChain { ex ->
            if (i == filters.size) {
                forwarded = ex
                Mono.empty()
            } else {
                filters[i].filter(ex, chainAt(i + 1))
            }
        }
        chainAt(0).filter(exchange).block(Duration.ofSeconds(20))
        return forwarded
    }

    Given("라우트 표") {
        Then("옛 game-ads 캐치올은 없다") {
            routes.none { it.id == "game-ads" } shouldBe true
        }
        Then("광고 경로는 전부 engagement 로 간다") {
            routes.filter { it.id.startsWith("ads-") }.map { it.uri.toString() }.toSet() shouldBe
                setOf("http://engagement:8091")
        }
        Then("허용 호스트의 공개 경로 다섯은 ads-public 이 받는다") {
            listOf(
                "/api/v1/ads/decisions",
                "/api/v1/ads/events",
                "/api/v1/ads/click/tok",
                "/api/v1/ads/assets/abc",
                "/api/v1/ads/placements/game-list-banner",
            ).forEach { firstMatch(it, "blog.1989v.com") shouldBe "ads-public" }
        }
        Then("광고주 경로는 ads-advertiser, 어드민 경로는 ads-admin 이 받는다") {
            firstMatch("/api/v1/ads/advertiser/campaigns", "1989v.com") shouldBe "ads-advertiser"
            firstMatch("/api/v1/ads/advertiser", "1989v.com") shouldBe "ads-advertiser"
            firstMatch("/api/v1/admin/ads/campaigns", "admin.1989v.com") shouldBe "ads-admin"
        }
        Then("rt 호스트의 공개 경로는 어떤 라우트에도 맞지 않는다") {
            firstMatch("/api/v1/ads/decisions", "rt.1989v.com") shouldBe null
            firstMatch("/api/v1/ads/click/tok", "rt.1989v.com") shouldBe null
        }
        Then("목록에 없는 경로는 /api/v1/ads 밑이어도 맞지 않는다 — 캐치올이 없다") {
            firstMatch("/api/v1/ads/unknown", "1989v.com") shouldBe null
        }
    }

    Given("rt.1989v.com 으로 들어온 결정 요청") {
        When("게이트웨이에 보내면") {
            Then("404 — rt 는 Cloudflare 를 거치지 않아 리미터 키를 위조할 수 있다") {
                client.post().uri("/api/v1/ads/decisions")
                    .header(HttpHeaders.HOST, "rt.1989v.com")
                    .exchange()
                    .expectStatus().isNotFound
            }
        }
    }

    Given("허용 호스트로 들어온 결정 요청") {
        When("게이트웨이에 보내면") {
            Then("라우트가 잡는다 — 404 가 아니다(백엔드가 없어 프록시 단계에서 실패)") {
                val status = client.post().uri("/api/v1/ads/decisions")
                    .header(HttpHeaders.HOST, "1989v.com")
                    .exchange()
                    .returnResult(String::class.java).status.value()
                status shouldNotBe 404
            }
        }
    }

    Given("광고주 경로") {
        When("토큰 없이 호출하면") {
            Then("401") {
                client.get().uri("/api/v1/ads/advertiser/campaigns")
                    .header(HttpHeaders.HOST, "1989v.com")
                    .exchange()
                    .expectStatus().isUnauthorized
            }
            Then("X-User-Id 를 손으로 붙여도 401") {
                client.get().uri("/api/v1/ads/advertiser/campaigns")
                    .header("X-User-Id", "7")
                    .exchange()
                    .expectStatus().isUnauthorized
            }
        }
    }

    Given("광고 어드민 경로") {
        When("토큰 없이 호출하면") {
            Then("401") {
                client.get().uri("/api/v1/admin/ads/campaigns")
                    .exchange()
                    .expectStatus().isUnauthorized
            }
        }
        When("일반 회원 토큰으로 호출하면") {
            Then("403") {
                val token = jwtUtil.generateAccessToken("7", listOf("ROLE_USER"))
                client.get().uri("/api/v1/admin/ads/campaigns")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
                    .exchange()
                    .expectStatus().isForbidden
            }
        }
    }

    Given("공개 경로에 신원 헤더가 실린 요청") {
        When("토큰 없이 X-User-Id 를 손으로 붙이면") {
            Then("백엔드로 나가는 요청에서 벗겨진다") {
                val exchange = MockServerWebExchange.from(
                    request("/api/v1/ads/decisions", "1989v.com") {
                        header("X-User-Id", "7")
                        header("X-User-Roles", "ROLE_ADMIN")
                    },
                )
                val forwarded = forwardedRequest("ads-public", exchange)
                forwarded shouldNotBe null
                forwarded!!.request.headers.getFirst("X-User-Id") shouldBe null
                forwarded.request.headers.getFirst("X-User-Roles") shouldBe null
            }
        }
        When("Bearer 토큰이 있으면") {
            Then("토큰의 회원 id 가 X-User-Id 로 실린다 — 광고주 본인 판정이 이것을 쓴다") {
                val token = jwtUtil.generateAccessToken("42", listOf("ROLE_USER"))
                val exchange = MockServerWebExchange.from(
                    request("/api/v1/ads/decisions", "1989v.com") {
                        header(HttpHeaders.AUTHORIZATION, "Bearer $token")
                        header("X-User-Id", "7")
                    },
                )
                val forwarded = forwardedRequest("ads-public", exchange)
                forwarded shouldNotBe null
                forwarded!!.request.headers.getFirst("X-User-Id") shouldBe "42"
            }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)
}
