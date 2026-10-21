package com.kgd.ranking

import com.kgd.ranking.application.cafe.dto.CafeNearbyItem
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class CafeStoreDisplayNameTest : BehaviorSpec({
    Given("source trade and branch names split in different places") {
        val cases = listOf(
            listOf("mega", "메가MGC커피", "메가엠지씨커피종로케이트윈", "타워점", "메가MGC커피 종로케이트윈타워점"),
            listOf("starbucks", "스타벅스", "스타벅스", "송파KT점", "스타벅스 송파KT점"),
            listOf("paik", "빽다방", "빽다방지하도점", "강남역", "빽다방 강남역지하도점"),
            listOf("compose", "컴포즈커피", "컴포즈커피사점", "강남역", "컴포즈커피 강남역사점"),
            listOf("starbucks", "스타벅스", "스타벅스", "강남R", "스타벅스 강남R"),
            listOf("starbucks", "스타벅스", "스타벅스 강남점", "강남점", "스타벅스 강남점"),
            listOf("starbucks", "스타벅스", "스타벅스강남점", "", "스타벅스 강남점"),
            listOf("starbucks", "스타벅스", "법인스타벅스", "강남역", "법인스타벅스 · 강남역"),
            listOf("starbucks", "스타벅스", "스타벅스강남점", "서초점", "스타벅스강남점 · 서초점"),
        )
        cases.forEach { (slug, brand, raw, branch, expected) ->
            Then("$raw / $branch displays as $expected without mutating source") {
                val item = CafeNearbyItem("s", slug, brand, raw, branch.ifBlank { null }, "서울", 37.5, 127.0, 1, "CONFIRMED", null, emptyList(), true, false, null)
                item.displayName shouldBe expected
                item.storeName shouldBe raw
                item.branchName shouldBe branch.ifBlank { null }
            }
        }
    }
})
