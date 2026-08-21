package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.data.forAll
import io.kotest.data.row
import io.kotest.matchers.shouldBe

class AttractionTitleTest : BehaviorSpec({

    given("원천 관광지명을 표시명/로컬명으로 가를 때") {
        `when`("꼬리 괄호에 한글이 있으면") {
            then("괄호 앞이 표시명, 괄호 안이 로컬명이다") {
                forAll(
                    row("Dosan Park(도산공원)", "Dosan Park", "도산공원"),
                    row("Dosan Park (도산공원)", "Dosan Park", "도산공원"),   // 괄호 앞 공백
                    row("Dosan Park（도산공원）", "Dosan Park", "도산공원"),  // 전각 괄호
                    row("청룡사(서울)", "청룡사", "서울"),                     // 국문 행의 지역 구분자
                    row("서울랜드(과천) ", "서울랜드", "과천"),                // 꼬리 공백
                    row("A(한1)(한2)", "A(한1)", "한2"),                       // 마지막 괄호만 꼬리다
                ) { raw, display, local ->
                    AttractionTitle.parse(raw) shouldBe AttractionTitle(display, local)
                }
            }
        }

        `when`("꼬리 괄호에 한글이 없거나 괄호가 꼬리가 아니면") {
            then("가르지 않는다 — 병기·본문 중간 괄호는 이름의 일부다") {
                forAll(
                    row("Seongsan Ilchulbong (Sunrise Peak)"),  // 영문 병기
                    row("성산일출봉(城山日出峰)"),               // 한자 병기
                    row("경복궁"),                               // 괄호 없음
                    row("Gyeongbokgung Palace"),
                    row("(도산공원)"),                           // 본문 없이 괄호만 — 가르면 표시명이 빈다
                    row("한옥마을(전주) 게스트하우스"),          // 괄호가 꼬리가 아니다
                ) { raw ->
                    AttractionTitle.parse(raw) shouldBe AttractionTitle(raw.trim(), null)
                }
            }
        }
    }

    given("Attraction 의 파생 표기") {
        `when`("전체 동기화로 title 이 바뀌면") {
            then("표시명/로컬명도 함께 따라간다 — 별도 갱신 경로가 없다") {
                val attraction = Attraction.create(
                    contentId = "3113200", lang = "en", title = "Dosan Park(도산공원)",
                    latitude = 37.524, longitude = 127.035,
                )
                attraction.titleDisplay shouldBe "Dosan Park"
                attraction.titleLocal shouldBe "도산공원"

                attraction.syncFrom(
                    Attraction.create(
                        contentId = "3113200", lang = "en", title = "Dosan Neighborhood Park",
                        latitude = 37.524, longitude = 127.035,
                    ),
                )
                attraction.titleDisplay shouldBe "Dosan Neighborhood Park"
                attraction.titleLocal shouldBe null
            }
        }
    }
})
