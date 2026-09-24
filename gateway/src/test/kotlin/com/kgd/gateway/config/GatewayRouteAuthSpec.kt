package com.kgd.gateway.config

import com.kgd.common.security.JwtUtil
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldNotBeIn
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
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
    val sellerToken = jwtUtil.generateAccessToken("8", listOf("ROLE_USER", "ROLE_SELLER"))

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

    Given("주문서 /api/v1/order-sheets/** (ROLE_USER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.POST, "/api/v1/order-sheets") shouldBe 401
            status(HttpMethod.GET, "/api/v1/order-sheets/1") shouldBe 401
        }
        Then("ROLE_USER 는 게이트웨이를 지난다") {
            // 백엔드 호스트를 해석할 수 없어 5xx 로 끝난다. 라우트가 없으면 404, 역할이 막으면 403 이다
            status(HttpMethod.POST, "/api/v1/order-sheets", userToken) shouldNotBeIn listOf(401, 403, 404)
            status(HttpMethod.GET, "/api/v1/order-sheets/1", userToken) shouldNotBeIn listOf(401, 403, 404)
        }
        Then("주문서 라우트는 레이트 리밋을 건다") {
            val route = routeLocator.routes.collectList().block().orEmpty().single { it.id == "order-sheet" }
            route.filters.joinToString(" ") { it.toString() } shouldContain "RequestRateLimiter"
        }
        Then("역할 헤더만 위조해서는 통과하지 못한다") {
            client.post().uri("/api/v1/order-sheets")
                .header("X-User-Id", "7")
                .header("X-User-Roles", "ROLE_USER")
                .exchange()
                .expectStatus().isUnauthorized
        }
    }

    Given("장바구니 /api/v1/cart/** (ROLE_USER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/cart") shouldBe 401
            status(HttpMethod.PUT, "/api/v1/cart/items/1") shouldBe 401
            status(HttpMethod.DELETE, "/api/v1/cart/items/1") shouldBe 401
            status(HttpMethod.DELETE, "/api/v1/cart") shouldBe 401
        }
        Then("ROLE_USER 는 게이트웨이를 지난다") {
            status(HttpMethod.GET, "/api/v1/cart", userToken) shouldNotBeIn listOf(401, 403, 404)
            status(HttpMethod.PUT, "/api/v1/cart/items/1", userToken) shouldNotBeIn listOf(401, 403, 404)
        }
    }

    Given("클레임 /api/v1/claims/** (ROLE_USER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.POST, "/api/v1/claims") shouldBe 401
            status(HttpMethod.GET, "/api/v1/claims?orderId=1") shouldBe 401
            status(HttpMethod.GET, "/api/v1/claims/preview?orderId=1") shouldBe 401
        }
        Then("ROLE_USER 는 게이트웨이를 지난다") {
            status(HttpMethod.POST, "/api/v1/claims", userToken) shouldNotBeIn listOf(401, 403, 404)
            status(HttpMethod.GET, "/api/v1/claims/preview?orderId=1", userToken) shouldNotBeIn listOf(401, 403, 404)
        }
        Then("구매 확정은 주문 라우트(ROLE_USER) — 토큰이 없으면 401") {
            status(HttpMethod.POST, "/api/v1/orders/1/purchase-confirm") shouldBe 401
        }
    }

    Given("판매자 클레임 결정 /api/v1/seller/claims/** (ROLE_SELLER)") {
        Then("토큰이 없으면 401, ROLE_USER 는 403") {
            status(HttpMethod.GET, "/api/v1/seller/claims") shouldBe 401
            status(HttpMethod.POST, "/api/v1/seller/claims/1/approve", userToken) shouldBe 403
            status(HttpMethod.POST, "/api/v1/seller/claims/1/reject", userToken) shouldBe 403
        }
        Then("ROLE_SELLER 는 게이트웨이를 지난다 — ACTIVE 판매자 행은 서비스가 본다") {
            status(HttpMethod.GET, "/api/v1/seller/claims", sellerToken) shouldNotBeIn listOf(401, 403, 404)
        }
    }

    Given("상품 어드민 /api/v1/admin/products/** (ROLE_ADMIN)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.POST, "/api/v1/admin/products/republish") shouldBe 401
        }
        Then("ROLE_USER·ROLE_SELLER 는 403") {
            status(HttpMethod.POST, "/api/v1/admin/products/republish", userToken) shouldBe 403
            status(HttpMethod.POST, "/api/v1/admin/products/republish", sellerToken) shouldBe 403
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

    Given("입점 신청 /api/v1/sellers/apply (ROLE_USER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.POST, "/api/v1/sellers/apply") shouldBe 401
        }
    }

    Given("내 입점 신청 /api/v1/sellers/me (ROLE_USER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/sellers/me") shouldBe 401
        }
        Then("ROLE_SELLER 가 없는 회원도 게이트웨이를 지난다 — 심사 중·반려 회원이 자기 상태를 봐야 한다") {
            // 백엔드 호스트를 해석할 수 없어 5xx 로 끝난다. 라우트가 없으면 404, 역할이 막으면 403 이다
            status(HttpMethod.GET, "/api/v1/sellers/me", userToken) shouldNotBeIn listOf(401, 403, 404)
        }
    }

    Given("판매자 포털 /api/v1/seller/** (ROLE_SELLER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/seller/me") shouldBe 401
        }
        Then("ROLE_USER 는 403") {
            status(HttpMethod.GET, "/api/v1/seller/me", userToken) shouldBe 403
        }
    }

    Given("판매자 관리 /api/v1/admin/sellers/** (ROLE_ADMIN)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/admin/sellers") shouldBe 401
            status(HttpMethod.POST, "/api/v1/admin/sellers/2/approve") shouldBe 401
        }
        Then("ROLE_USER·ROLE_SELLER 는 403") {
            status(HttpMethod.GET, "/api/v1/admin/sellers", userToken) shouldBe 403
            status(HttpMethod.POST, "/api/v1/admin/sellers/2/approve", sellerToken) shouldBe 403
        }
    }

    Given("결제 운영 이슈 /api/v1/admin/payments/** (ROLE_ADMIN)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/admin/payments/ops-issues") shouldBe 401
            status(HttpMethod.POST, "/api/v1/admin/payments/ops-issues/1/retry") shouldBe 401
        }
        Then("ROLE_USER·ROLE_SELLER 는 403") {
            status(HttpMethod.GET, "/api/v1/admin/payments/ops-issues", userToken) shouldBe 403
            status(HttpMethod.POST, "/api/v1/admin/payments/ops-issues/1/close", sellerToken) shouldBe 403
        }
    }

    Given("토스 웹훅 /api/v1/payments/webhooks/toss (공개 · 서명은 서비스가 본다)") {
        Then("토큰 없이 게이트웨이를 지난다 — 위조 신원 헤더를 붙여도 막히지 않고 벗겨진다") {
            // 백엔드 호스트를 해석할 수 없어 5xx 로 끝난다. 라우트가 없으면 404, 인증 필터가 막으면 401 이다
            client.post().uri("/api/v1/payments/webhooks/toss")
                .header("X-User-Id", "1")
                .header("X-User-Roles", "ROLE_ADMIN")
                .header("Content-Type", "application/json")
                .exchange()
                .returnResult(String::class.java)
                .status.value() shouldNotBeIn listOf(401, 403, 404)
        }
        Then("웹훅 라우트는 신원 헤더를 지우고 레이트 리밋을 건다") {
            val route = routeLocator.routes.collectList().block().orEmpty().single { it.id == "payment-webhook-toss" }
            val filters = route.filters.joinToString(" ") { it.toString() }
            filters shouldContain "X-User-Id"
            filters shouldContain "X-User-Roles"
            filters shouldContain "RequestRateLimiter"
        }
        Then("같은 접두의 다른 결제 경로는 공개로 열리지 않는다") {
            status(HttpMethod.POST, "/api/v1/payments/webhooks/other") shouldBe 404
            status(HttpMethod.GET, "/api/v1/payments/1") shouldBe 404
        }
    }

    Given("혜택 어드민 /api/v1/admin/promotions/** (ROLE_ADMIN)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/admin/promotions/coupons") shouldBe 401
            status(HttpMethod.POST, "/api/v1/admin/promotions/points/grants") shouldBe 401
        }
        Then("ROLE_USER·ROLE_SELLER 는 403") {
            status(HttpMethod.POST, "/api/v1/admin/promotions/coupons", userToken) shouldBe 403
            status(HttpMethod.POST, "/api/v1/admin/promotions/points/grants", sellerToken) shouldBe 403
        }
    }

    Given("내 쿠폰·포인트 · 쿠폰 받기 (ROLE_USER)") {
        Then("토큰이 없으면 401") {
            status(HttpMethod.GET, "/api/v1/coupons/me") shouldBe 401
            status(HttpMethod.GET, "/api/v1/points/me") shouldBe 401
            status(HttpMethod.POST, "/api/v1/coupons/3/claim") shouldBe 401
        }
        Then("ROLE_USER 는 게이트웨이를 지난다") {
            // 백엔드 호스트를 해석할 수 없어 5xx 로 끝난다. 라우트가 없으면 404, 역할이 막으면 403 이다
            status(HttpMethod.GET, "/api/v1/coupons/me", userToken) shouldNotBeIn listOf(401, 403, 404)
            status(HttpMethod.GET, "/api/v1/points/me", userToken) shouldNotBeIn listOf(401, 403, 404)
            status(HttpMethod.POST, "/api/v1/coupons/3/claim", userToken) shouldNotBeIn listOf(401, 403, 404)
        }
        Then("열어 둔 세 경로 밖의 쿠폰 경로는 라우트가 없다") {
            status(HttpMethod.GET, "/api/v1/coupons/3", userToken) shouldBe 404
            status(HttpMethod.GET, "/api/v1/points/7", userToken) shouldBe 404
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
