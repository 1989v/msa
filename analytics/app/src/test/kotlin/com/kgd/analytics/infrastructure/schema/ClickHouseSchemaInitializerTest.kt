package com.kgd.analytics.infrastructure.schema

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.springframework.core.io.support.PathMatchingResourcePatternResolver

class ClickHouseSchemaInitializerTest : BehaviorSpec({

    given("한 파일에 여러 문장이 있을 때") {
        `when`("문장으로 가르면") {
            then("세미콜론마다 하나씩 나와야 한다 — JDBC 는 한 번에 하나만 받는다") {
                val stmts = ClickHouseSchemaInitializer.statementsOf(
                    """
                    DROP TABLE IF EXISTS analytics.events;
                    CREATE TABLE analytics.events (a String) ENGINE = MergeTree ORDER BY a;
                    """.trimIndent(),
                )
                stmts shouldHaveSize 2
                stmts[0] shouldBe "DROP TABLE IF EXISTS analytics.events"
                stmts[1] shouldContain "CREATE TABLE"
            }
        }
    }

    given("주석에 세미콜론이 들어 있을 때") {
        `when`("문장으로 가르면") {
            then("주석 때문에 문장이 잘리면 안 된다") {
                // 이 레포의 SQL 은 주석이 길다. `--` 안의 세미콜론으로 끊기면
                // 앞뒤가 반쪽 SQL 이 되어 기동 때마다 조용히 실패한다.
                val stmts = ClickHouseSchemaInitializer.statementsOf(
                    """
                    -- 설명: 이 표는 a; b; c 를 담는다
                    CREATE TABLE t (a String) ENGINE = MergeTree ORDER BY a;
                    """.trimIndent(),
                )
                stmts shouldHaveSize 1
                stmts[0] shouldContain "CREATE TABLE t"
                stmts[0] shouldNotContain "설명"
            }
        }
    }

    given("실제 스키마 파일들") {
        `when`("전부 읽어 가르면") {
            then("빈 문장이 없고 모두 실행 가능한 모양이어야 한다") {
                // 검사가 스스로 만든 SQL 이 아니라 **배포되는 파일**을 본다.
                val scripts = PathMatchingResourcePatternResolver()
                    .getResources("classpath*:clickhouse/analytics/*.sql")
                    .sortedBy { it.filename }
                scripts.size shouldBe 6
                scripts.forEach { script ->
                    val stmts = ClickHouseSchemaInitializer.statementsOf(
                        script.inputStream.bufferedReader().readText(),
                    )
                    withClue(script.filename) {
                        stmts.isNotEmpty() shouldBe true
                        stmts.forEach { it.isBlank() shouldBe false }
                    }
                }
            }
        }
    }

    given("두 축 스키마") {
        `when`("events 정의를 보면") {
            then("대상과 동작이 따로 있고 위치가 계층이어야 한다 (ADR-0095)") {
                // 한 축으로 되돌아가면 대상이 늘 때마다 enum 이 곱해진다.
                val sql = PathMatchingResourcePatternResolver()
                    .getResource("classpath:clickhouse/analytics/V005__events_two_axis.sql")
                    .inputStream.bufferedReader().readText()
                    .lineSequence().filterNot { it.trimStart().startsWith("--") }.joinToString("\n")
                listOf("entity_type", "entity_id", "action",
                       "screen_type", "screen_ref", "section_id", "section_index", "item_index",
                       "view_id").forEach { sql shouldContain it }
                sql shouldNotContain "event_type"      // 대상×동작을 누른 옛 축
                sql shouldNotContain "product_id"      // 대상별 nullable 컬럼
            }
        }
    }
})
