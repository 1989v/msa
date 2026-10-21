package com.kgd.ranking.domain.cafe.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class DrinkNamesTest : BehaviorSpec({
    Given("boundary presentation tokens") {
        Then("temperature and explicit size strip repeatedly while recipe words stay") {
            listOf("H-아메리카노", "I-아메리카노", "(L) HOT 아메리카노", "아메리카노 (R)", "(EX) 아메리카노", "아메리카노 (EX)").forEach {
                DrinkNames.normalize(it) shouldBe "아메리카노"
            }
            listOf("빅 아메리카노", "빽사이즈 아메리카노", "아이스크림 라떼", "아메리카노 (오리지널)").forEach {
                DrinkNames.normalize(it) shouldBe it.replace(" ", "")
            }
            listOf("디카페인 아메리카노", "I-디카페인 아메리카노", "디카페인아메리카노").forEach { DrinkNames.normalize(it) shouldBe "아메리카노" }
            DrinkNames.normalize("디카페인") shouldBe "디카페인"
            listOf("카라멜 마키아또", "카라멜마끼아또", "아이스 카라멜 마끼야또").forEach { DrinkNames.normalize(it) shouldBe "카라멜마끼아또" }
            DrinkNames.normalize("바닐라 라테") shouldBe "바닐라라떼"
            listOf("I-바닐라라떼", "아이스 바닐라 라떼", "(L) ICED 바닐라 라떼").forEach { DrinkNames.normalize(it) shouldBe "바닐라라떼" }
            listOf("(EX) HOT 연유 카페 라떼", "(EX) ICED 연유 카페 라떼", "연유 카페 라떼 (EX)").forEach { DrinkNames.normalize(it) shouldBe "연유카페라떼" }
            DrinkNames.normalize("  (L)  ICE   연유 라떼  ") shouldBe "연유라떼"
            DrinkNames.normalize(DrinkNames.normalize("(L) HOT 라떼")) shouldBe "라떼"
        }
    }
})
