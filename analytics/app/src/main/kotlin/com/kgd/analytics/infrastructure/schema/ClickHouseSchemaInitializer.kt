package com.kgd.analytics.infrastructure.schema

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * ClickHouse 스키마를 기동 시 적용한다 (ADR-0095).
 *
 * **사람 손을 전제하지 않는 이유**: 이 파일들은 원래 「수동 적용」 전제였고 그 결과 운영에서
 * 120일 동안 한 번도 적용되지 않았다. 소유한 서비스가 자기 스키마를 책임진다.
 *
 * **각 스크립트는 한 번만 돈다.** 처음 판은 「전부 IF NOT EXISTS 니 매번 돌려도 된다」고
 * 보고 기동마다 전부 돌렸는데, V005 가 `DROP TABLE` 을 담고 있어 **재시작할 때마다 원장이
 * 통째로 지워졌다** — 배포 세 번에 노출 64,165건이 세 번 사라졌다 (2026-09-17). IF NOT EXISTS
 * 는 CREATE 를 멱등으로 만들 뿐 DROP 은 아니다. 적용한 파일 이름을 표에 남기고 있는 것은
 * 건너뛴다. Flyway 가 하는 그 일이다.
 *
 * **기동을 막지 않는다.** ClickHouse 가 잠깐 늦게 뜨는 것과 앱이 죽는 것은 다른 문제다.
 */
@Component
class ClickHouseSchemaInitializer(
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
) {
    private val log = KotlinLogging.logger {}

    @EventListener(ApplicationReadyEvent::class)
    fun apply() {
        val scripts = PathMatchingResourcePatternResolver()
            .getResources("classpath*:$LOCATION/*.sql")
            .sortedBy { it.filename }          // 파일명 순서가 곧 적용 순서다
        if (scripts.isEmpty()) {
            log.warn { "[clickhouse] 적용할 스키마 파일이 없다 — $LOCATION" }
            return
        }

        runCatching {
            dataSource.connection.use { conn ->
                conn.createStatement().use { st ->
                    st.execute(CREATE_HISTORY)
                    val applied = st.executeQuery("SELECT version FROM $HISTORY").use { rs ->
                        generateSequence { if (rs.next()) rs.getString(1) else null }.toSet()
                    }
                    var ran = 0
                    scripts.forEach { script ->
                        val name = script.filename ?: return@forEach
                        if (name in applied) return@forEach
                        val sql = script.inputStream.bufferedReader().readText()
                        statementsOf(sql).forEach { st.execute(it) }
                        // 성공한 뒤에만 기록한다 — 중간에 죽으면 다음 기동이 그 파일부터 다시 한다
                        st.execute("INSERT INTO $HISTORY (version) VALUES ('${name.replace("'", "''")}')")
                        log.info { "[clickhouse] 적용 $name" }
                        ran++
                    }
                    log.info { "[clickhouse] 스키마 ${scripts.size}개 중 ${ran}개 새로 적용, ${scripts.size - ran}개 이미 적용됨" }
                }
            }
        }.onFailure {
            log.error(it) { "[clickhouse] 스키마 적용 실패 — 다음 기동에서 다시 시도한다" }
        }
    }

    companion object {
        private const val LOCATION = "clickhouse/analytics"
        private const val HISTORY = "analytics.schema_migrations"

        /** 적용 이력. 이 표가 있어야 DROP 을 담은 스크립트를 두 번 돌리지 않는다. */
        private const val CREATE_HISTORY = """
            CREATE TABLE IF NOT EXISTS $HISTORY
            (
                version    String,
                applied_at DateTime DEFAULT now()
            )
            ENGINE = MergeTree
            ORDER BY version
        """

        /**
         * 한 파일에 여러 문장이 올 수 있다. JDBC 는 한 번에 하나만 받는다.
         * 주석 줄을 먼저 걷어내는 이유: `--` 주석 안의 세미콜론이 문장을 잘못 끊는다.
         */
        fun statementsOf(sql: String): List<String> =
            sql.lineSequence()
                .filterNot { it.trimStart().startsWith("--") }
                .joinToString("\n")
                .split(";")
                .map { it.trim() }
                .filter { it.isNotEmpty() }
    }
}
