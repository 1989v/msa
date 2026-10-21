package com.kgd.ranking

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.flywaydb.core.api.migration.Context
import rankingdb.migration.V4__cafe_drink_name
import java.sql.DriverManager

class CafeDrinkNameMigrationTest : BehaviorSpec({
    Given("V4 in the configured classpath migration directory") {
        Then("the compiled migration is discoverable and backfills using the domain rule") {
            (javaClass.classLoader.getResource("rankingdb/migration/V4__cafe_drink_name.class") != null) shouldBe true
            DriverManager.getConnection("jdbc:h2:mem:cafe_name_migration").use { connection ->
                connection.createStatement().use {
                    it.execute("CREATE TABLE cafe_drink (id BIGINT PRIMARY KEY, menu_name VARCHAR(255))")
                    it.execute("INSERT INTO cafe_drink VALUES (1, '(L) HOT 디카페인 라떼'), (2, '(EX) HOT 연유 카페 라떼'), (3, '(EX) ICED 연유 카페 라떼'), (4, '연유 카페 라떼 (EX)')")
                }
                val context = mockk<Context>()
                every { context.connection } returns connection
                V4__cafe_drink_name().migrate(context)
                connection.createStatement().use { statement -> statement.executeQuery("SELECT menu_name, drink_name FROM cafe_drink ORDER BY id").use {
                    it.next(); it.getString(1) shouldBe "(L) HOT 디카페인 라떼"; it.getString(2) shouldBe "라떼"
                    repeat(3) { _ -> it.next(); it.getString(2) shouldBe "연유카페라떼" }
                } }
            }
        }
    }
})
