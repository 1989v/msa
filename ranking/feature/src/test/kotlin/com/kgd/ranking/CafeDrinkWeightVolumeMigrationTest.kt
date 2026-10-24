package com.kgd.ranking

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.flywaydb.core.api.migration.Context
import rankingdb.migration.V8__cafe_drink_weight_volume
import rankingdb.migration.V9__cafe_drink_volume_rules
import java.math.BigDecimal
import java.sql.DriverManager

class CafeDrinkWeightVolumeMigrationTest : BehaviorSpec({
    Given("V8 over stored rows whose cup volume was not derivable before") {
        Then("gram-only rows and Twosome frappes get stored volumes while admin-verified effective volumes stay") {
            (javaClass.classLoader.getResource("rankingdb/migration/V8__cafe_drink_weight_volume.class") != null) shouldBe true
            DriverManager.getConnection("jdbc:h2:mem:cafe_weight_volume_migration").use { connection ->
                val columns = "id BIGINT PRIMARY KEY, brand_slug VARCHAR(40), menu_name VARCHAR(255), source_category VARCHAR(255), temperature VARCHAR(20), size_label VARCHAR(60), " +
                    "volume_ml DECIMAL(14,4), serving_basis TEXT, kcal DECIMAL(14,4), sugar_g DECIMAL(14,4), caffeine_mg DECIMAL(14,4), " +
                    "cup_volume_ml DECIMAL(14,4), volume_source VARCHAR(30), sugar_per_100ml DECIMAL(14,4), caffeine_per_100ml DECIMAL(14,4), kcal_per_100ml DECIMAL(14,4)"
                connection.createStatement().use {
                    it.execute("CREATE TABLE cafe_drink ($columns)")
                    it.execute("CREATE TABLE cafe_drink_effective ($columns)")
                    val rows = "(1, 'dunkin', '아메리카노', '에스프레소', '', 'S', NULL, '1회 제공량(g) 310', 15, 0, 155, NULL, 'NONE', NULL, NULL, NULL), " +
                        "(2, 'twosome', '프라페', 'TROPICAL FRAPPE', '', 'R', NULL, NULL, 207, 41.4, 82.8, NULL, 'NONE', NULL, NULL, NULL), " +
                        "(3, 'twosome', '라떼', 'THE OTHERS', '', 'R', NULL, NULL, 100, 10, 50, NULL, 'NONE', NULL, NULL, NULL)"
                    it.execute("INSERT INTO cafe_drink VALUES $rows")
                    it.execute("INSERT INTO cafe_drink_effective VALUES $rows, (4, 'dunkin', '라떼', NULL, '', '', NULL, '1회 제공량(g) 400', 100, 10, 50, 500, 'ADMIN_VERIFIED', 2, 10, 20)")
                }
                val context = mockk<Context>()
                every { context.connection } returns connection
                V8__cafe_drink_weight_volume().migrate(context)
                listOf("cafe_drink", "cafe_drink_effective").forEach { table ->
                    connection.createStatement().use { statement -> statement.executeQuery("SELECT cup_volume_ml, volume_source, sugar_per_100ml, caffeine_per_100ml, kcal_per_100ml FROM $table ORDER BY id").use {
                        it.next(); it.getBigDecimal(1).compareTo(BigDecimal("310")) shouldBe 0; it.getString(2) shouldBe "WEIGHT_ESTIMATE"; it.getBigDecimal(4).compareTo(BigDecimal("50")) shouldBe 0
                        it.next(); it.getBigDecimal(1).compareTo(BigDecimal("414")) shouldBe 0; it.getString(2) shouldBe "BRAND_SIZE_TABLE"; it.getBigDecimal(3).compareTo(BigDecimal("10")) shouldBe 0
                        it.next(); it.getBigDecimal(1) shouldBe null; it.getString(2) shouldBe "NONE"; it.getBigDecimal(5) shouldBe null
                        if (table == "cafe_drink_effective") { it.next(); it.getBigDecimal(1).compareTo(BigDecimal("500")) shouldBe 0; it.getString(2) shouldBe "ADMIN_VERIFIED" }
                    } }
                }
            }
        }
    Given("V9 over stored rows written before oz sizes and Twosome ICE BLENDED were known") {
        Then("both get brand size table volumes") {
            (javaClass.classLoader.getResource("rankingdb/migration/V9__cafe_drink_volume_rules.class") != null) shouldBe true
            DriverManager.getConnection("jdbc:h2:mem:cafe_volume_rules_migration").use { connection ->
                val columns = "id BIGINT PRIMARY KEY, brand_slug VARCHAR(40), menu_name VARCHAR(255), source_category VARCHAR(255), temperature VARCHAR(20), size_label VARCHAR(60), " +
                    "volume_ml DECIMAL(14,4), serving_basis TEXT, kcal DECIMAL(14,4), sugar_g DECIMAL(14,4), caffeine_mg DECIMAL(14,4), " +
                    "cup_volume_ml DECIMAL(14,4), volume_source VARCHAR(30), sugar_per_100ml DECIMAL(14,4), caffeine_per_100ml DECIMAL(14,4), kcal_per_100ml DECIMAL(14,4)"
                connection.createStatement().use {
                    it.execute("CREATE TABLE cafe_drink ($columns)")
                    it.execute("CREATE TABLE cafe_drink_effective ($columns)")
                    val rows = "(1, 'twosome', '쉐이크', 'ICE BLENDED', '', 'R', NULL, NULL, 414, 41.4, 0, NULL, 'NONE', NULL, NULL, NULL), " +
                        "(2, 'uzi', '라떼', '커피', 'HOT', '20oz', NULL, '사이즈 20oz', 591, 59.1, 0, NULL, 'NONE', NULL, NULL, NULL)"
                    it.execute("INSERT INTO cafe_drink VALUES $rows")
                    it.execute("INSERT INTO cafe_drink_effective VALUES $rows")
                }
                val context = mockk<Context>()
                every { context.connection } returns connection
                V9__cafe_drink_volume_rules().migrate(context)
                connection.createStatement().use { statement -> statement.executeQuery("SELECT cup_volume_ml, volume_source, sugar_per_100ml FROM cafe_drink_effective ORDER BY id").use {
                    it.next(); it.getBigDecimal(1).compareTo(BigDecimal("414")) shouldBe 0; it.getString(2) shouldBe "BRAND_SIZE_TABLE"; it.getBigDecimal(3).compareTo(BigDecimal("10")) shouldBe 0
                    it.next(); it.getBigDecimal(1).compareTo(BigDecimal("591")) shouldBe 0; it.getString(2) shouldBe "BRAND_SIZE_TABLE"; it.getBigDecimal(3).compareTo(BigDecimal("10")) shouldBe 0
                } }
            }
        }
    }
    }
})
