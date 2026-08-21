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
                    listOf("INSTAGRAM", "YOUTUBE", "MYREALTRIP", "KLOOK")
                links[0].url shouldBe "https://www.instagram.com/explore/tags/전주한옥마을역사관/"
                links[1].url shouldBe "https://www.youtube.com/results?search_query=%EC%A0%84%EC%A3%BC+%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84+%EC%97%AD%EC%82%AC%EA%B4%80"
                links[2].url shouldBe "https://www.myrealtrip.com/search?q=%EC%A0%84%EC%A3%BC+%ED%95%9C%EC%98%A5%EB%A7%88%EC%9D%84+%EC%97%AD%EC%82%AC%EA%B4%80"
            }
        }
        `when`("영문 관광지명이면") {
            then("태그는 소문자로 붙여야 한다") {
                AttractionDeepLinks.instagramTag("Gyeongbokgung Palace") shouldBe "gyeongbokgungpalace"
            }
        }
        `when`("원천 제목에 꼬리 괄호가 붙어 있으면") {
            then("표시명으로 가른 뒤 조립해야 한다 — 원문 그대로면 태그·검색어가 불가능해진다") {
                // 호출자(AttractionLinkService)가 titleDisplay 를 넘기는 규약의 근거.
                // 원문을 그대로 넣으면 `dosanpark도산공원` — 어디에도 없는 태그다.
                val display = AttractionTitle.parse("Dosan Park(도산공원)").display
                AttractionDeepLinks.instagramTag(display) shouldBe "dosanpark"
                val links = AttractionDeepLinks.of(display)
                links[1].url shouldBe "https://www.youtube.com/results?search_query=Dosan+Park"
                links[2].url shouldBe "https://www.myrealtrip.com/search?q=Dosan+Park"
            }
        }
        `when`("문장부호만 남는 이름이면") {
            then("인스타 링크를 만들지 않는다") {
                // 유튜브 검색은 원문 그대로 인코딩해 나간다 — 태그와 달리 문장부호가 있어도 검색이 된다
                AttractionDeepLinks.of("!!!").map { it.provider } shouldContainExactly
                    listOf("YOUTUBE", "MYREALTRIP", "KLOOK")
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
