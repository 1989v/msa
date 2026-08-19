package com.kgd.deal

import com.kgd.deal.application.service.DealRedirectService
import com.kgd.deal.application.service.RedirectDecision
import com.kgd.deal.presentation.controller.DealRedirectController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus

class DealRedirectControllerTest : BehaviorSpec({

    // 블록마다 새 목을 쓴다 — 스펙 단위로 공유하면 앞 블록의 호출이 뒤 블록의 verify 를 오염시킨다
    fun controllerWith(decision: RedirectDecision, recordFails: Boolean = false): Pair<DealRedirectController, DealRedirectService> {
        val service = mockk<DealRedirectService>()
        every { service.resolve(any(), any()) } returns decision
        if (recordFails) {
            every { service.recordClick(any(), any(), any()) } throws IllegalStateException("DB down")
        } else {
            every { service.recordClick(any(), any(), any()) } returns Unit
        }
        return DealRedirectController(service) to service
    }

    given("살아 있는 오퍼의 slug 로 들어오면") {
        val target = "https://link.coupang.com/a/x?lptag=AF123"

        `when`("정상 해석되면") {
            val (controller, service) = controllerWith(RedirectDecision.Go(offerId = 7L, targetUrl = target))
            val response = controller.go("coupang-rocket", referer = "https://t.co/abc", userAgent = "Mozilla/5.0")

            then("302 로 원본 URL 을 그대로 넘긴다") {
                response.statusCode shouldBe HttpStatus.FOUND
                // 파라미터를 재조립하면 네트워크 약관 위반이고 트래킹 쿠키가 깨진다
                response.headers.location.toString() shouldBe target
            }

            then("색인·링크추적을 막는다 — robots.txt 를 무시하는 수집기가 있다") {
                // 색인되면 제휴 트래킹 URL 이 검색결과에 남고 302 를 따라간 신호가 제휴사로 넘어간다
                response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
            }

            then("302 를 캐시하지 못하게 막는다") {
                response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            }

            then("클릭을 적재한다") {
                verify { service.recordClick(7L, "https://t.co/abc", "Mozilla/5.0") }
            }
        }

        `when`("클릭 적재가 실패하면") {
            val (controller, _) = controllerWith(
                RedirectDecision.Go(offerId = 7L, targetUrl = target),
                recordFails = true,
            )
            val response = controller.go("coupang-rocket", referer = null, userAgent = null)

            then("그래도 302 를 낸다 — 통계는 부수고 리다이렉트가 본질이다") {
                response.statusCode shouldBe HttpStatus.FOUND
                response.headers.location.toString() shouldBe target
            }
        }
    }

    given("만료됐거나 내려간 오퍼면") {
        val (controller, service) = controllerWith(RedirectDecision.Unavailable("travel"))
        val response = controller.go("expired-promo", referer = null, userAgent = null)

        then("404 가 아니라 해당 카테고리 목록으로 보낸다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.headers.location.toString() shouldBe "/?category=travel"
        }

        then("클릭은 세지 않는다") {
            verify(exactly = 0) { service.recordClick(any(), any(), any()) }
        }
    }

    given("없는 slug 면") {
        val (controller, _) = controllerWith(RedirectDecision.NotFound)

        then("404 를 낸다") {
            controller.go("nope", referer = null, userAgent = null).statusCode shouldBe HttpStatus.NOT_FOUND
        }
    }
})
