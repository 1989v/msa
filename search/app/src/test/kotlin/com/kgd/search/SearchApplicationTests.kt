package com.kgd.search

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class SearchApplicationTests : BehaviorSpec({
    given("Search 애플리케이션") {
        `when`("기본 동작 확인") {
            then("항상 통과") {
                true shouldBe true
            }
        }
    }
})
