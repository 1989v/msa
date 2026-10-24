package com.kgd.ranking

import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.ranking.application.shortlink.service.RankingShortLinkService
import com.kgd.ranking.presentation.controller.RankingShortLinkController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus

class RankingShortLinkControllerTest : BehaviorSpec({
    Given("/r/cafe") {
        val response = RankingShortLinkController(RankingShortLinkService(ShortLinkProperties(rankOrigin = "https://rank.example.com/"))).cafe()
        Then("설정의 랭킹 호스트 카페 비교로 302 하고 캐시·색인을 막는다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.headers.getFirst(HttpHeaders.LOCATION) shouldBe "https://rank.example.com/cafe"
            response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
        }
    }
})
