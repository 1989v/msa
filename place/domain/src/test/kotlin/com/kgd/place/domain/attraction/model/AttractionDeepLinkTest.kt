package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe

class AttractionDeepLinkTest : BehaviorSpec({

    given("관광지명으로 딥링크를 조립할 때") {
        `when`("국문 관광지명이면") {
            then("인스타 태그는 붙여 쓰고 검색어는 URL 인코딩되어야 한다") {
                val links = AttractionDeepLinks.of("전주 한옥마을 역사관", "12")
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
                val links = AttractionDeepLinks.of(display, "76")
                links[1].url shouldBe "https://www.youtube.com/results?search_query=Dosan+Park"
                links[2].url shouldBe "https://www.myrealtrip.com/search?q=Dosan+Park"
            }
        }
        `when`("문장부호만 남는 이름이면") {
            then("인스타 링크를 만들지 않는다") {
                // 유튜브 검색은 원문 그대로 인코딩해 나간다 — 태그와 달리 문장부호가 있어도 검색이 된다
                AttractionDeepLinks.of("!!!", "12").map { it.provider } shouldContainExactly
                    listOf("YOUTUBE", "MYREALTRIP", "KLOOK")
            }
        }
    }

    given("수수료 표시") {
        `when`("제휴 승인 전이면") {
            then("전부 PLAIN 이어야 한다 — 받지도 않는 수수료를 고지하지 않는다") {
                AttractionDeepLinks.of("경복궁", "12").forEach { it.revenueType shouldBe LinkRevenueType.PLAIN }
            }
        }
    }
    given("숙박 유형의 딥링크") {
        // 숙박은 투어 상품 검색 링크를 내지 않는다 — 제휴 승인 때 스펙 변경 없이 숙박 제휴 링크가 되는 길을 막는다.
        // 이름은 searchStay2 운영 표본(2026-10-02)의 국문 32 · 영문 80 행이다.
        val tourProducts = setOf("MYREALTRIP", "KLOOK")

        `when`("국문 숙박(32)·영문 숙박(80)이면") {
            then("마이리얼트립·Klook 이 없고 소셜 링크는 남는다") {
                val ko = AttractionDeepLinks.of("산골흙집", "32").map { it.provider }
                val en = AttractionDeepLinks.of("Yangji Pine Resort", "80").map { it.provider }
                ko shouldContainExactly listOf("INSTAGRAM", "YOUTUBE")
                en shouldContainExactly listOf("INSTAGRAM", "YOUTUBE")
            }
        }
        `when`("같은 실행의 관광지(12)·유형 없는 옛 행이면") {
            then("투어 상품 링크가 그대로 있다 — 숙박 제외가 전부를 끄는 무동작이 아님을 보이는 대조군") {
                AttractionDeepLinks.of("경복궁", "12").map { it.provider }.filter { it in tourProducts } shouldContainExactly
                    listOf("MYREALTRIP", "KLOOK")
                AttractionDeepLinks.of("경복궁", null).map { it.provider }.filter { it in tourProducts } shouldContainExactly
                    listOf("MYREALTRIP", "KLOOK")
            }
        }
    }
})
