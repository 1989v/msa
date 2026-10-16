package com.kgd.place.application.market.service

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class MarketKoreanRomanizerTest : BehaviorSpec({
    Given("국어 로마자 표기 고정 사례") {
        // Fixed expectations from the approved examples and standard sound-change rules.
        listOf(
            "순희네빈대떡" to "Sunhuine Bindaetteok", "광장시장" to "Gwangjang Sijang",
            "남대문" to "Namdaemun", "신라" to "Silla", "독립문" to "Dongnimmun",
            "종로" to "Jongno", "한라산" to "Hallasan", "부산" to "Busan",
            "백마" to "Baengma", "왕십리" to "Wangsimni", "해돋이" to "Haedoji",
            "좋고" to "Joko", "놓다" to "Nota", "낙동강" to "Nakdonggang",
            "대구" to "Daegu", "고기" to "Gogi", "가락" to "Garak",
            "바다" to "Bada", "밥" to "Bap", "국밥" to "Gukbap",
            "한국" to "Hanguk", "먹는" to "Meongneun", "앞문" to "Ammun",
            "같이" to "Gachi", "굳이" to "Guji", "옷이" to "Osi",
            "떡이" to "Tteogi", "국화" to "Gukhwa", "좋다" to "Jota",
            "굳히다" to "Guchida", "묻히다" to "Muchida",
            "놓아" to "Noa", "값이" to "Gapsi", "설날" to "Seollal",
            "싫어" to "Sireo", "닳아" to "Dara",
            "ABC-123 & Shop!" to "ABC-123 & Shop!", "가게2호(A점)" to "Gage2Ho(AJeom)"
        ).forEach { (korean, english) -> Then("$korean → $english") { KoreanRomanizer.romanize(korean) shouldBe english } }
    }
})
