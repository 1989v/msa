package com.kgd.gateway.filter

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.http.HttpCookie
import org.springframework.http.HttpHeaders
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import reactor.core.publisher.Mono

/**
 * 방문자 쿠키는 응답 헤더를 보고 심는다 — 공개 캐시 응답에 개인 쿠키가 붙으면 Cloudflare 가 캐시하지 않는다(ADR-0105).
 * 판정 근거: 다운스트림이 정한 응답 헤더를 지닌 채 커밋된 실제 응답의 Set-Cookie.
 */
class VisitorIdFilterTest : BehaviorSpec({
    val filter = VisitorIdFilter()

    /** 다운스트림(서비스)이 응답 헤더를 정하고 응답을 커밋하는 체인 */
    fun downstream(cacheControl: String?) = GatewayFilterChain { exchange ->
        cacheControl?.let { exchange.response.headers.set(HttpHeaders.CACHE_CONTROL, it) }
        exchange.response.setComplete()
    }

    fun run(cacheControl: String?, cookie: String? = null): MockServerWebExchange {
        val request = MockServerHttpRequest.get("/api/places/air").let { r -> cookie?.let { r.cookie(HttpCookie("vid", it)) } ?: r }.build()
        val exchange = MockServerWebExchange.from(request)
        filter.filter(exchange, downstream(cacheControl)).block()
        return exchange
    }

    given("쿠키 없는 첫 요청") {
        `when`("응답이 공개 캐시면") {
            then("쿠키를 심지 않는다 — 엣지가 그 응답을 여러 사람에게 내준다") {
                run("max-age=60, public, s-maxage=600, stale-while-revalidate=300").response.cookies["vid"] shouldBe null
            }
        }
        `when`("응답이 캐시하지 않는 것이면") {
            then("쿠키를 심는다") {
                run("no-cache, no-store, max-age=0, must-revalidate").response.cookies["vid"] shouldNotBe null
                run(null).response.cookies["vid"] shouldNotBe null
            }
        }
    }

    given("쿠키가 이미 있는 요청") {
        then("다시 심지 않는다") {
            run("no-store", cookie = "abc").response.cookies["vid"] shouldBe null
        }
    }

    given("public 판정") {
        then("지시 목록에서 public 토큰만 본다") {
            VisitorIdFilter.isPublicCache("max-age=60, PUBLIC") shouldBe true
            VisitorIdFilter.isPublicCache("private, max-age=60") shouldBe false
            VisitorIdFilter.isPublicCache(null) shouldBe false
        }
    }
})
