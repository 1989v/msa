package com.kgd.search.infrastructure.job

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.every
import io.mockk.mockk
import java.math.BigDecimal
import java.sql.ResultSet
import java.sql.Timestamp

/**
 * DB 재색인은 `products` 를 SQL 로 직접 읽는다 — 금액은 원 단위 정수 컬럼(`price_won`)에서 온다.
 * 옛 `price` DECIMAL 컬럼은 다음 배포에서 지워지므로 이 리더가 그 컬럼을 부르면 그때 재색인이 깨진다.
 */
class ProductDbRowMapperTest : BehaviorSpec({

    fun resultSet(priceWon: Any?): ResultSet = mockk(relaxed = true) {
        every { getLong("id") } returns 7L
        every { getString("name") } returns "두부"
        every { getObject("price_won") } returns priceWon
        every { getInt("stock") } returns 3
        every { getString("status") } returns "ACTIVE"
        every { getObject(match<String> { it != "price_won" }) } returns null
        every { getTimestamp("created_at") } returns Timestamp.valueOf("2026-09-25 10:00:00")
    }

    Given("상품 행 SELECT") {
        Then("금액은 price_won 에서 읽고 옛 price 컬럼은 부르지 않는다") {
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

    Given("price_won 이 비어 있는 행(롤백 기간에 옛 코드가 쓴 행)") {
        Then("0 원으로 색인하지 않고 백필이 필요하다고 멈춘다") {
            shouldThrow<IllegalStateException> { mapProductRow(resultSet(null)) }.message!! shouldContain "price_won"
        }
    }
})

private infix fun List<String>.shouldContainColumn(column: String) = contains(column) shouldBe true
