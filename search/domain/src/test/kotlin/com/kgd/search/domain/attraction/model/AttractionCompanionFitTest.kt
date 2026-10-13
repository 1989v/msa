package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe

class AttractionCompanionFitTest : BehaviorSpec({

    val kids = setOf(AttractionCompanion.KIDS)

    given("원천 소분류") {
        then("아이 대상 시설(동물원·체험농장·어린이공원)은 소개 원문이 없어도 붙는다") {
            AttractionCompanionFit.of("VE020300", emptyMap()) shouldBe kids
            AttractionCompanionFit.of("EX030300", emptyMap()) shouldBe kids
            AttractionCompanionFit.of("VE030300", emptyMap()) shouldBe kids
        }
        then("다른 분류(쇼핑·고궁)는 붙지 않는다") {
            AttractionCompanionFit.of("SH010100", emptyMap()).shouldBeEmpty()
            AttractionCompanionFit.of("HS010100", emptyMap()).shouldBeEmpty()
            AttractionCompanionFit.of(null, emptyMap()).shouldBeEmpty()
        }
    }

    given("체험 가능 연령(expagerange*)") {
        then("어린이·유아·초등·영문 kids 를 말하면 분류와 무관하게 붙는다 — 유형별 꼬리 키도 본다") {
            AttractionCompanionFit.of("HS010100", mapOf("expagerange" to "초등학생 이상")) shouldBe kids
            AttractionCompanionFit.of(null, mapOf("expagerange" to "유아~성인")) shouldBe kids
            AttractionCompanionFit.of(null, mapOf("expagerangeleports" to "Kids aged 7 and up")) shouldBe kids
            AttractionCompanionFit.of(null, mapOf("expagerange" to "CHILDREN welcome")) shouldBe kids
        }
        then("「전연령」·「all ages」만이면 붙지 않는다 — 반려견 공원이 붙었다") {
            AttractionCompanionFit.of(null, mapOf("expagerange" to "전연령")).shouldBeEmpty()
            AttractionCompanionFit.of(null, mapOf("expagerange" to "All ages")).shouldBeEmpty()
            AttractionCompanionFit.of(null, mapOf("expagerange" to null)).shouldBeEmpty()
        }
        then("연령 키가 아닌 곳의 같은 말은 보지 않는다") {
            AttractionCompanionFit.of(null, mapOf("infocenter" to "어린이 문의")).shouldBeEmpty()
        }
    }
})
