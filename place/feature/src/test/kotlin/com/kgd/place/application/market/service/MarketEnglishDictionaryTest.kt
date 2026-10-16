package com.kgd.place.application.market.service

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class MarketEnglishDictionaryTest : BehaviorSpec({
    val dictionary = MarketEnglishDictionary()
    Given("고정 영문 업종/품목 사전") {
        Then("운영 소분류 207종 모두 빠짐없이 번역한다") {
            val labels = requireNotNull(javaClass.getResourceAsStream("/market/category-subs.txt"))
                .bufferedReader().readLines().filter { it.isNotBlank() && !it.startsWith("#") }
            labels.size shouldBe 207
            labels.filter { dictionary.category(it).isNullOrBlank() } shouldBe emptyList()
            dictionary.category("소매") shouldBe "Retail"
            dictionary.category("식료품 소매") shouldBe "Food retail"
        }
        Then("운영 중분류 71종도 모두 번역하며, 끝 공백이 붙은 원천 값도 찾는다") {
            val labels = requireNotNull(javaClass.getResourceAsStream("/market/category-mids.txt"))
                .bufferedReader().readLines().filter { it.isNotBlank() && !it.startsWith("#") }
            labels.size shouldBe 71
            labels.filter { dictionary.category(it).isNullOrBlank() } shouldBe emptyList()
            dictionary.category("장례식장 ") shouldBe "Funeral hall"
        }
        Then("fixture 온누리 품목과 음식명을 번역하고 미등록값은 null이다") {
            dictionary.items("농축수산품") shouldBe "Agricultural livestock and seafood products"
            dictionary.items("맞춤복점") shouldBe "Custom tailoring"
            dictionary.items("떡볶이") shouldBe "tteokbokki"
            dictionary.items("알수없는품목") shouldBe null
            dictionary.category("알수없는업종") shouldBe null
            dictionary.category(null) shouldBe null
        }
        Then("영문 업종 검색어와 음식명이 분식에 연결된다") {
            dictionary.categoryLabels("SNACK FOOD") shouldBe setOf("김밥/만두/분식", "분식")
            MarketDishDictionary().categories("TTEOKBOKKI") shouldBe setOf("김밥/만두/분식")
            MarketDishDictionary().categories("kimbap") shouldBe setOf("김밥/만두/분식")
        }
    }
})
