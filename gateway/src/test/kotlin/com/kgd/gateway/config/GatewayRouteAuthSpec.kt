package com.kgd.gateway.config

import com.kgd.common.security.JwtUtil
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.core.env.Environment
import org.springframework.http.HttpMethod
import org.springframework.test.web.reactive.server.WebTestClient

/**
 * 커머스 라우트의 인증 경계 — 무토큰 401 · 역할 부족 403 · `/internal` 라우트 없음 · 옛 경로 없음.
 *
 * 통과하는 경우(백엔드로 프록시)는 여기서 보지 않는다 — `commerce` 호스트를 해석할 수 없어서다.
 * 여기서 보는 것은 게이트웨이가 스스로 끝내는 응답뿐이다. Redis 는 닫힌 포트라 블랙리스트 조회가
 * 실패하고 fail-open 으로 넘어간다([GatewayRoutingSpec] 과 같은 설정).
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.data.redis.host=localhost",
        "spring.data.redis.port=16379",
        "logging.level.org.springframework.cloud.gateway=INFO",
    ],
)
class GatewayRouteAuthSpec(
    @Autowired private val env: Environment,
    @Autowired private val routeLocator: RouteLocator,
    @Autowired private val jwtUtil: JwtUtil,
) : BehaviorSpec({

    val client = WebTestClient
        .bindToServer()
        .baseUrl("http://localhost:${env.getRequiredProperty("local.server.port")}")
        .build()

    val userToken = jwtUtil.generateAccessToken("7", listOf("ROLE_USER"))
    val adminToken = jwtUtil.generateAccessToken("1", listOf("ROLE_ADMIN"))

    fun status(method: HttpMethod, path: String, token: String? = null): Int =
        client.method(method).uri(path)
            .apply { token?.let { header("Authorization", "Bearer $it") } }
            .header("Content-Type", "application/json")
            .exchange()
            .returnResult(String::class.java)
            .status.value()

    Given("상품 쓰기 (ROLE_SELLER · ROLE_ADMIN)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.POST, "/api/v1/products") shouldBe 401
            status(HttpMethod.PUT, "/api/v1/products/1") shouldBe 401
        }
        Then("ROLE_USER 는 403") {
            status(HttpMethod.POST, "/api/v1/products", userToken) shouldBe 403
            status(HttpMethod.PUT, "/api/v1/products/1", userToken) shouldBe 403
        }
        Then("역할 헤더만 위조해서는 통과하지 못한다") {
            client.put().uri("/api/v1/products/1")
                .header("X-User-Id", "1")
                .header("X-User-Roles", "ROLE_ADMIN")
                .exchange()
                .expectStatus().isUnauthorized
        }
    }

    Given("주문 (ROLE_USER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/orders/my") shouldBe 401
            status(HttpMethod.POST, "/api/v1/orders") shouldBe 401
        }
    }

    Given("주문 매출 통계 (ROLE_ADMIN)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/admin/orders/stats/today") shouldBe 401
        }
        Then("ROLE_USER 는 403") {
            status(HttpMethod.GET, "/api/v1/admin/orders/stats/today", userToken) shouldBe 403
        }
    }

    Given("클러스터 안 전용 경로 /internal") {
        Then("어드민 토큰으로도 404 — 라우트가 없다") {
            status(HttpMethod.POST, "/internal/products/bulk", adminToken) shouldBe 404
        }
        Then("라우트 표 어디에도 /internal 경로가 없다") {
            routeLocator.routes.collectList().block().orEmpty()
                .filter { it.predicate.toString().contains("/internal") }
                .map { it.id }
                .shouldBeEmpty()
        }
    }

    Given("옛 경로 (브리지 없음)") {
        Then("/api/products · /api/orders 는 404") {
            status(HttpMethod.GET, "/api/products/1") shouldBe 404
            status(HttpMethod.GET, "/api/orders/my", userToken) shouldBe 404
            status(HttpMethod.GET, "/api/orders/stats/today", adminToken) shouldBe 404
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)
}
