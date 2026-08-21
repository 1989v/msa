package com.kgd.gateway.config

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.test.web.reactive.server.WebTestClient

/**
 * 게이트웨이 라우트 표의 인증 경계를 고정한다.
 *
 * 여기서 보는 것은 "요청이 백엔드로 나가기 전에 어떻게 끝나는가" 뿐이다 —
 * 미정의 경로는 404, 인증이 필요한 경로는 무인증 시 401. 백엔드로 실제 프록시되는
 * 경로는 이 스펙에서 다루지 않는다(호스트 해석이 필요해 단위 검증 대상이 아님).
 *
 * Redis 는 닫힌 포트를 가리켜 연결이 즉시 실패하고, 이를 fail-open 으로 넘기는
 * 전역 필터 경로까지 함께 지난다.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.data.redis.host=localhost",
        "spring.data.redis.port=16379",
        "logging.level.org.springframework.cloud.gateway=INFO",
    ],
)
class GatewayRoutingSpec(
    @Autowired private val env: Environment,
) : BehaviorSpec({

    val client = WebTestClient
        .bindToServer()
        .baseUrl("http://localhost:${env.getRequiredProperty("local.server.port")}")
        .build()

    fun status(path: String) = client.get().uri(path).exchange().returnResult(String::class.java)
        .status.value()

    Given("라우트가 정의되지 않은 경로") {
        When("무인증으로 호출하면") {
            Then("404 로 끝난다 — 백엔드까지 가지 않는다") {
                status("/api/nonexistent-xyz") shouldBe 404
            }
        }
    }

    Given("member 서비스에 구현체가 없는 /api/members 목록 경로") {
        When("무인증으로 호출하면") {
            Then("/api/members 는 404") {
                status("/api/members") shouldBe 404
            }
            Then("/api/members/ 도 404") {
                status("/api/members/") shouldBe 404
            }
        }
    }

    Given("내부 전용 SSO 엔드포인트") {
        When("게이트웨이로 직접 POST 하면") {
            Then("라우트가 없어 404 — auth 서비스만 서비스 간 호출로 접근한다") {
                client.post().uri("/api/members/sso")
                    .header("Content-Type", "application/json")
                    .bodyValue("""{"email":"a@b.c","name":"x","ssoProvider":"GOOGLE","ssoProviderId":"1"}""")
                    .exchange()
                    .expectStatus().isNotFound
            }
        }
    }

    Given("인증이 필요한 라우트") {
        When("토큰 없이 호출하면") {
            Then("/api/members/me 는 401") {
                status("/api/members/me") shouldBe 401
            }
            Then("/api/members/stats/count 는 401 (ADMIN 경계)") {
                status("/api/members/stats/count") shouldBe 401
            }
            Then("/api/v1/wishlist 는 401") {
                status("/api/v1/wishlist") shouldBe 401
            }
            Then("/api/orders 는 401") {
                status("/api/orders") shouldBe 401
            }
            // 권한 부여 API 는 auth 서비스에 자체 검증이 없어 게이트웨이가 유일한 경계다.
            // 공개 라우트인 /api/auth/** 가 이 경로를 먼저 삼키면 안 된다.
            Then("/api/auth/roles/1 은 401 (ADMIN 경계)") {
                status("/api/auth/roles/1") shouldBe 401
            }
        }

        When("X-User-Roles 를 위조해서 보내면") {
            Then("헤더만으로는 통과하지 못하고 401") {
                client.get().uri("/api/members/stats/count")
                    .header("X-User-Id", "1")
                    .header("X-User-Roles", "ROLE_ADMIN")
                    .exchange()
                    .expectStatus().isUnauthorized
            }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)
}
