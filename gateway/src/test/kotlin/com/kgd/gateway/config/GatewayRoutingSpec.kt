package com.kgd.gateway.config

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cloud.gateway.route.RouteLocator
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
    @Autowired private val routeLocator: RouteLocator,
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

    // 친구 그룹은 별칭 목록이라 남의 것이 열리면 그 사람 지인의 이름이 샌다.
    // 카탈로그 캐치올(/api/v1/games/**)은 필터가 없어 손으로 붙인 X-User-Id 를 그대로 통과시킨다.
    Given("친구 그룹 경로") {
        When("토큰 없이 호출하면") {
            Then("/api/v1/games/party/rosters 는 401") {
                status("/api/v1/games/party/rosters") shouldBe 401
            }
        }

        When("X-User-Id 를 손으로 붙여 보내면") {
            Then("헤더만으로는 남의 그룹을 못 읽는다") {
                client.get().uri("/api/v1/games/party/rosters")
                    .header("X-User-Id", "1")
                    .exchange()
                    .expectStatus().isUnauthorized
            }
            Then("쓰기도 막힌다 — 덮어쓰기·삭제가 더 위험하다") {
                client.delete().uri("/api/v1/games/party/rosters/1")
                    .header("X-User-Id", "1")
                    .exchange()
                    .expectStatus().isUnauthorized
            }
        }
    }

    // ADR-0093 — 재편의 가장 큰 위험은 라우팅이다. 파드가 합쳐지면 목적지 호스트 이름이
    // 바뀌는데, 라우트를 하나 빠뜨려도 게이트웨이는 멀쩡히 뜨고 그 경로만 죽는다
    // (2026-09-11: product 를 commerce 로 옮기고 게이트웨이 이미지가 안 나가 /api/v1/products 가
    //  운영에서 404 였다). 그래서 **목적지 이름의 집합**을 검사로 고정한다.
    Given("라우트 표의 목적지") {
        Then("모든 라우트가 실재하는 파드 이름을 가리킨다") {
            // k8s/base/*/service.yaml 로 존재하는 백엔드 Service 이름.
            // 파드를 합치거나 이름을 바꾸면 여기도 같이 고친다 — 고치지 않으면 이 검사가 먼저 깨진다.
            val knownServices = setOf(
                "auth", "search", "analytics", "engagement", "account",
                "sideapp", "code-dictionary", "commerce", "place",
            )
            val destinations = routeLocator.routes.collectList().block().orEmpty()
                .map { it.uri }
                .filter { it.scheme == "http" || it.scheme == "https" }
                .mapNotNull { it.host }
                .toSortedSet()
            destinations.filterNot { it in knownServices } shouldBe emptyList<String>()
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)
}
