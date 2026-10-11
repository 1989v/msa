package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/** 경계값은 리터럴로 쓴다 — 상수 이름으로 경계를 만들면 상수를 낮춰도 초록이다. */
class AttractionSaveSignalTest : BehaviorSpec({

    given("찜 하한") {
        then("하한은 3명이다") {
            AttractionSaveSignal.SAVED_MIN shouldBe 3
        }
        then("2명 이하·값 없음은 근거가 아니다") {
            AttractionSaveSignal.meetsMin(null) shouldBe false
            AttractionSaveSignal.meetsMin(0) shouldBe false
            AttractionSaveSignal.meetsMin(2) shouldBe false
        }
        then("3명부터 근거가 된다") {
            AttractionSaveSignal.meetsMin(3) shouldBe true
            AttractionSaveSignal.meetsMin(40) shouldBe true
        }
    }
})
