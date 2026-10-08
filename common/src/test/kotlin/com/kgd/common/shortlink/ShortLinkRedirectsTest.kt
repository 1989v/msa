package com.kgd.common.shortlink

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus

class ShortLinkRedirectsTest : BehaviorSpec({

    given("목적지로 302 응답을 만들면") {
        val response = ShortLinkRedirects.redirect("https://game.1989v.com/games/x")

        then("Location 과 캐시·색인 금지 헤더를 싣고 본문은 없다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.headers.getFirst(HttpHeaders.LOCATION) shouldBe "https://game.1989v.com/games/x"
            response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
            response.body shouldBe null
        }
    }
})
