package com.kgd.gateway.filter

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange

/**
 * 판정 근거: 다운스트림이 커밋한 실제 응답의 `X-Robots-Tag` 헤더.
 */
class ApiNoIndexFilterTest : BehaviorSpec({
    val filter = ApiNoIndexFilter()
    val downstream = GatewayFilterChain { exchange -> exchange.response.setComplete() }

    fun robotsTagOf(path: String): String? {
        val exchange = MockServerWebExchange.from(MockServerHttpRequest.get(path).build())
        filter.filter(exchange, downstream).block()
        return exchange.response.headers.getFirst("X-Robots-Tag")
    }

    given("API 응답") {
        then("noindex 를 붙인다") {
            robotsTagOf("/api/search/attractions/21") shouldBe "noindex"
            robotsTagOf("/api/v1/blog/posts") shouldBe "noindex"
        }
    }
    given("서버 렌더 페이지 — 게이트웨이를 지나지만 색인 대상") {
        then("붙이지 않는다") {
            robotsTagOf("/attractions/21") shouldBe null
            robotsTagOf("/posts/some-slug") shouldBe null
            robotsTagOf("/apis-guide") shouldBe null
        }
    }
})
