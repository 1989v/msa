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

class ClickHouseSchemaInitializerRunOnceTest : io.kotest.core.spec.style.BehaviorSpec({

    /** 실행된 SQL 을 전부 받아 두는 가짜 JDBC. `SELECT version` 에는 미리 적용된 목록을 돌려준다. */
    class FakeDb(alreadyApplied: List<String>) {
        val executed = mutableListOf<String>()
        val dataSource: javax.sql.DataSource = io.mockk.mockk()

        init {
            val conn: java.sql.Connection = io.mockk.mockk(relaxed = true)
            val st: java.sql.Statement = io.mockk.mockk(relaxed = true)
            val rs: java.sql.ResultSet = io.mockk.mockk()
            val queue = java.util.ArrayDeque(alreadyApplied)
            io.mockk.every { rs.next() } answers { queue.isNotEmpty() }
            io.mockk.every { rs.getString(1) } answers { queue.poll() }
            io.mockk.every { rs.close() } returns Unit
            io.mockk.every { dataSource.connection } returns conn
            io.mockk.every { conn.createStatement() } returns st
            io.mockk.every { st.execute(any()) } answers { executed += firstArg<String>(); true }
            io.mockk.every { st.executeQuery(any()) } answers { executed += firstArg<String>(); rs }
        }
    }

    Given("아직 아무것도 적용되지 않은 환경") {
        val db = FakeDb(alreadyApplied = emptyList())
        ClickHouseSchemaInitializer(db.dataSource).apply()

        Then("스크립트를 전부 돌리고 각각 이력에 남긴다") {
            val inserts = db.executed.filter { it.startsWith("INSERT INTO analytics.schema_migrations") }
            inserts.size shouldBe 6
            inserts.any { "V005__events_two_axis.sql" in it } shouldBe true
        }
        Then("V005 의 DROP 이 실행된다 — 옛 표를 새 표로 바꾸는 일회성 작업이다") {
            db.executed.any { it.startsWith("DROP TABLE IF EXISTS analytics.events") } shouldBe true
        }
    }

    Given("전부 적용된 환경 (운영이 재시작할 때)") {
        val db = FakeDb(alreadyApplied = listOf(
            "V001__product_scores.sql", "V002__product_scores_smoothing_gmv.sql",
            "V003__search_judgments_and_eval.sql", "V004__events.sql",
            "V005__events_two_axis.sql", "V006__attraction_popularity_daily.sql",
        ))
        ClickHouseSchemaInitializer(db.dataSource).apply()

        Then("DROP 을 다시 돌리지 않는다 — 돌리면 재시작마다 원장이 사라진다") {
            // 실제로 배포 세 번에 노출 64,165건이 세 번 지워졌다 (2026-09-17)
            db.executed.none { it.startsWith("DROP TABLE") } shouldBe true
        }
        Then("이력에 다시 쓰지도 않는다") {
            db.executed.none { it.startsWith("INSERT INTO analytics.schema_migrations") } shouldBe true
        }
    }

    Given("일부만 적용된 환경") {
        val db = FakeDb(alreadyApplied = listOf(
            "V001__product_scores.sql", "V002__product_scores_smoothing_gmv.sql",
            "V003__search_judgments_and_eval.sql", "V004__events.sql",
        ))
        ClickHouseSchemaInitializer(db.dataSource).apply()

        Then("안 된 것만 돌린다") {
            val inserts = db.executed.filter { it.startsWith("INSERT INTO analytics.schema_migrations") }
            inserts.map { Regex("V\\d+__[a-z_]+\\.sql").find(it)!!.value } shouldBe
                listOf("V005__events_two_axis.sql", "V006__attraction_popularity_daily.sql")
        }
    }
})
