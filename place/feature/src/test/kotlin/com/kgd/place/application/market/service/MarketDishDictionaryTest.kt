package com.kgd.place.application.market.service

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual

class MarketDishDictionaryTest : BehaviorSpec({
    val dictionary = MarketDishDictionary()
    Given("the checked-in dish dictionary and known category fixture") {
        Then("every dish maps only to a category that exists in production, and no row repeats a pair") {
            val categories = javaClass.getResourceAsStream("/market/category-subs.txt")!!.bufferedReader()
                .useLines { it.filter { line -> line.isNotBlank() && !line.startsWith("#") }.toSet() }
            dictionary.dishes().size shouldBeGreaterThanOrEqual 90
            dictionary.dishes().map { it.dish to it.categorySub }.distinct().size shouldBe dictionary.dishes().size
            dictionary.dishes().all { it.categorySub in categories } shouldBe true
        }
        Then("only exact dish or romanized dish expands; English ignores case") {
            dictionary.categories("TTEOKBOKKI") shouldBe setOf("김밥/만두/분식")
            dictionary.categories("떡볶이") shouldBe setOf("김밥/만두/분식")
            dictionary.categories("떡볶") shouldBe emptySet()
            dictionary.categories("유부초밥") shouldBe setOf("김밥/만두/분식", "일식 회/초밥")
        }
    }
})
