package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe

class AttractionDeepLinkTest : BehaviorSpec({

    given("관광지명으로 딥링크를 조립할 때") {
        `when`("국문 관광지명이면") {
            then("인스타 태그는 붙여 쓰고 검색어는 URL 인코딩되어야 한다") {
                val links = AttractionDeepLinks.of("전주 한옥마을 역사관")
                links.map { it.provider } shouldContainExactly
                    listOf("INSTAGRAM", "MYREALTRIP", "KLOOK")
                links[0].url shouldBe "https://www.instagram.com/explore/tags/전주한옥마을역사관/"
                links[1].url shouldBe "https://www.myrealtrip.com/search?q=%EC%A0%84%EC%A3%BC+%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84+%EC%97%AD%EC%82%AC%EA%B4%80"
            }
        }
        `when`("영문 관광지명이면") {
            then("태그는 소문자로 붙여야 한다") {
                AttractionDeepLinks.instagramTag("Gyeongbokgung Palace") shouldBe "gyeongbokgungpalace"
            }
        }
        `when`("문장부호만 남는 이름이면") {
            then("인스타 링크를 만들지 않는다") {
                AttractionDeepLinks.of("!!!").map { it.provider } shouldContainExactly
                    listOf("MYREALTRIP", "KLOOK")
            }
        }
    }

    given("수수료 표시") {
        `when`("제휴 승인 전이면") {
            then("전부 PLAIN 이어야 한다 — 받지도 않는 수수료를 고지하지 않는다") {
                AttractionDeepLinks.of("경복궁").forEach { it.revenueType shouldBe LinkRevenueType.PLAIN }
            }
        }
    }
})
