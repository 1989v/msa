package com.kgd.gateway.config

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.context.annotation.Bean
import org.springframework.core.env.Environment
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.test.web.reactive.server.WebTestClient
import reactor.core.publisher.Mono
import java.net.InetSocketAddress
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 공유용 단축 주소 라우트(`/r` `/p` `/g` `/b` `/c`)의 목적지·인증·리미터 키를 고정한다.
 *
 * 리미터 키는 이름이 아니라 실제 요청으로 판정한다 — `ipKeyResolver` 빈을 기록하는 것으로 바꿔 끼우고
 * `/g/…` 를 호출해, 그 요청이 이 리졸버를 거쳤는지를 본다. 단축 경로에는 인증 필터가 없어
 * 클라이언트가 붙인 `X-User-Id` 가 지워지지 않으므로, 헤더를 키로 쓰는 리졸버가 걸리면 헤더만 바꿔 우회된다.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.data.redis.host=localhost",
        "spring.data.redis.port=16379",
        "spring.main.allow-bean-definition-overriding=true",
    ],
)
class ShortLinkRouteSpec(
    @Autowired private val env: Environment,
    @Autowired private val routeLocator: RouteLocator,
) : BehaviorSpec({

    val client = WebTestClient
        .bindToServer()
        .baseUrl("http://localhost:${env.getRequiredProperty("local.server.port")}")
        .build()

    val routes = routeLocator.routes.collectList().block().orEmpty().associateBy { it.id }

    Given("단축 주소 라우트") {
        Then("이력서는 atlas, 관광지·게임·글은 content 로 간다") {
            routes.getValue("short-link-resume").uri.host shouldBe "atlas"
            routes.getValue("short-link-content").uri.host shouldBe "content"
        }
        Then("인증 필터가 없다 — 받은 사람은 로그인하지 않는다") {
            listOf("short-link-resume", "short-link-content").forEach { id ->
                routes.getValue(id).filters.any { it.toString().contains("Authentication") } shouldBe false
            }
        }
        Then("접두사를 떼지 않는다 — 도메인 컨트롤러가 /g/{code} 그대로 받는다") {
            listOf("short-link-resume", "short-link-content").forEach { id ->
                routes.getValue(id).filters.map { it.toString() }
                    .any { it.contains("StripPrefix") && it.contains("parts = 0") } shouldBe true
            }
        }
    }

    Given("묶음 단축 주소 라우트 short-link-collection") {
        val route = routes.getValue("short-link-collection")
        val filters = route.filters.map { it.toString() }

        Then("공유 묶음을 가진 account 로 간다") {
            route.uri.host shouldBe "account"
        }
        Then("인증 필터가 없고 접두사를 떼지 않는다") {
            filters.any { it.contains("Authentication") } shouldBe false
            filters.any { it.contains("StripPrefix") && it.contains("parts = 0") } shouldBe true
        }
        Then("레이트 리밋을 걸고 신원 헤더 셋을 지운다") {
            filters.any { it.contains("RequestRateLimiter") } shouldBe true
            listOf("X-User-Id", "X-User-Roles", "Authorization").forEach { header ->
                filters.any { it.contains("RemoveRequestHeader") && it.contains(header) } shouldBe true
            }
        }
    }

    Given("공유 묶음 공개 라우트 wishlist-shared-public") {
        Then("익명 열람이라 레이트 리밋을 건다") {
            routes.getValue("wishlist-shared-public").filters
                .any { it.toString().contains("RequestRateLimiter") } shouldBe true
        }
    }

    Given("X-User-Id 를 요청마다 바꿔 보내는 클라이언트") {
        When("/g/{code} 를 호출하면") {
            RecordingIpKeyResolver.seen.clear()
            listOf("1", "2").forEach { uid ->
                client.get().uri("/g/5mZiq85").header("X-User-Id", uid).exchange()
            }
            Then("두 요청 모두 ipKeyResolver 를 거친다") {
                RecordingIpKeyResolver.seen shouldContainAll listOf("/g/5mZiq85")
                RecordingIpKeyResolver.seen.size shouldBe 2
            }
        }
    }

    Given("ipKeyResolver") {
        val resolver = RateLimiterConfig().ipKeyResolver()
        fun keyOf(uid: String) = resolver.resolve(
            MockServerWebExchange.from(
                MockServerHttpRequest.get("/g/5mZiq85")
                    .header("X-User-Id", uid)
                    .remoteAddress(InetSocketAddress("203.0.113.7", 40000))
                    .build(),
            ),
        ).block()

        Then("X-User-Id 가 달라도 같은 주소면 같은 키다") {
            keyOf("1") shouldBe keyOf("2")
            keyOf("1") shouldBe "203.0.113.7"
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)

    @TestConfiguration
    class RecordingIpKeyResolver {
        companion object {
            val seen = CopyOnWriteArrayList<String>()
        }

        @Bean
        fun ipKeyResolver(): KeyResolver = KeyResolver { exchange ->
            seen += exchange.request.path.value()
            Mono.just(exchange.request.remoteAddress?.address?.hostAddress ?: "unknown")
        }
    }
}
