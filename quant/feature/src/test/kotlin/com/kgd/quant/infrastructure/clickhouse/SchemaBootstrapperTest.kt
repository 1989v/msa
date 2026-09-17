package com.kgd.quant.infrastructure.clickhouse

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeSorted
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldEndWith

class SchemaBootstrapperTest : BehaviorSpec({
    val bootstrapper = SchemaBootstrapper()

    given("classpath 의 quant DDL") {
        `when`("ddlResourcePaths() 를 부르면") {
            then("V001 부터 V012 까지 전부, 파일명 순으로 온다") {
                val paths = bootstrapper.ddlResourcePaths()
                paths shouldHaveSize 12
                paths.first() shouldEndWith "/V001__create_database.sql"
                paths.last() shouldEndWith "/V012__fundamentals_ownership.sql"
                paths.shouldBeSorted()
            }
        }
    }

    given("주석과 여러 문장이 섞인 DDL 본문") {
        `when`("statementsOf 로 나누면") {
            then("주석 안의 세미콜론은 문장을 끊지 않고 빈 문장은 버린다") {
                val sql = """
                    -- 첫 줄 주석; 세미콜론 포함
                    CREATE DATABASE IF NOT EXISTS quant; -- 뒤 주석
                    CREATE TABLE IF NOT EXISTS quant.t (id UInt64) ENGINE = MergeTree ORDER BY id;

                """.trimIndent()
                SchemaBootstrapper.statementsOf(sql) shouldBe listOf(
                    "CREATE DATABASE IF NOT EXISTS quant",
                    "CREATE TABLE IF NOT EXISTS quant.t (id UInt64) ENGINE = MergeTree ORDER BY id",
                )
            }
        }
    }
})
