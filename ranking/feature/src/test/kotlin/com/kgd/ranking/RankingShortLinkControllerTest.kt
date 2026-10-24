package com.kgd.ranking

import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.ranking.application.shortlink.service.RankingShortLinkService
import com.kgd.ranking.presentation.controller.RankingShortLinkController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class RankingShortLinkControllerTest : BehaviorSpec({
    val controller = RankingShortLinkController(RankingShortLinkService(ShortLinkProperties(rankOrigin = "https://rank.example.com/")))
    val mvc = MockMvcBuilders.standaloneSetup(controller).build()

    Given("/rk/cafe") {
        val response = controller.cafe()
        Then("설정의 랭킹 호스트 카페 비교로 302 하고 캐시·색인을 막는다") {
            response.statusCode shouldBe HttpStatus.FOUND
            response.headers.getFirst(HttpHeaders.LOCATION) shouldBe "https://rank.example.com/cafe"
            response.headers.getFirst(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            response.headers.getFirst("X-Robots-Tag") shouldBe "noindex, nofollow"
        }
    }
    Given("경로 매핑") {
        Then("별칭은 카페로, /rk 와 모르는 별칭은 랭킹 홈으로 간다") {
            mvc.get("/rk/cafe").andExpect { status { isFound() }; header { string(HttpHeaders.LOCATION, "https://rank.example.com/cafe") } }
            mvc.get("/rk").andExpect { status { isFound() }; header { string(HttpHeaders.LOCATION, "https://rank.example.com/") } }
            mvc.get("/rk/unknown").andExpect { status { isFound() }; header { string(HttpHeaders.LOCATION, "https://rank.example.com/") } }
        }
    }
})
