package com.kgd.gateway.config

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import java.net.InetSocketAddress

class AdsRouteKeyResolverSpec : BehaviorSpec({

    val resolver = RateLimiterConfig().adsClientIpKeyResolver()

    fun key(request: MockServerHttpRequest): String? =
        resolver.resolve(MockServerWebExchange.from(request)).block()

    Given("광고 공개 라우트의 리미터 키") {
        When("CF-Connecting-IP 가 있으면") {
            Then("그 값을 쓴다 — 클러스터 안에서 remoteAddress 는 ingress 파드 IP 하나다") {
                key(
                    MockServerHttpRequest.get("/api/v1/ads/decisions")
                        .remoteAddress(InetSocketAddress("10.42.0.9", 50000))
                        .header("CF-Connecting-IP", "203.0.113.7")
                        .build(),
                ) shouldBe "203.0.113.7"
            }
        }
        When("CF-Connecting-IP 가 없으면") {
            Then("remoteAddress 를 쓴다") {
                key(
                    MockServerHttpRequest.get("/api/v1/ads/decisions")
                        .remoteAddress(InetSocketAddress("10.42.0.9", 50000))
                        .build(),
                ) shouldBe "10.42.0.9"
            }
        }
        When("X-User-Id 가 실려 있어도") {
            Then("회원 id 가 아니라 IP 로 센다") {
                key(
                    MockServerHttpRequest.get("/api/v1/ads/decisions")
                        .remoteAddress(InetSocketAddress("10.42.0.9", 50000))
                        .header("X-User-Id", "7")
                        .build(),
                ) shouldBe "10.42.0.9"
            }
        }
    }
})
