package com.kgd.search.infrastructure.job

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import java.math.BigDecimal
import java.sql.ResultSet
import java.sql.Timestamp

/** DB 재색인은 `products` 를 SQL 로 직접 읽는다 — 금액은 원 단위 정수 컬럼(`price_won`)에서 온다 */
class ProductDbRowMapperTest : BehaviorSpec({

    fun resultSet(priceWon: Long): ResultSet = mockk(relaxed = true) {
        every { getLong("id") } returns 7L
        every { getString("name") } returns "두부"
        every { getLong("price_won") } returns priceWon
        every { getInt("stock") } returns 3
        every { getString("status") } returns "ACTIVE"
        every { getObject(any<String>()) } returns null
        every { getTimestamp("created_at") } returns Timestamp.valueOf("2026-09-25 10:00:00")
    }

    Given("상품 행 SELECT") {
        Then("금액은 price_won 에서 읽는다 — 없는 price 컬럼을 부르지 않는다") {
            val columns = PRODUCT_DB_SELECT.removePrefix("SELECT").split(",").map { it.trim() }
            columns shouldContainColumn "price_won"
            columns.contains("price") shouldBe false
        }
    }

    Given("price_won 이 있는 행") {
        Then("그 값이 문서 금액이 된다") {
            mapProductRow(resultSet(12000L)).price shouldBe BigDecimal.valueOf(12000L)
        }
    }
})

private infix fun List<String>.shouldContainColumn(column: String) = contains(column) shouldBe true
