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
 * **사람 손을 전제하지 않는 이유**: 이 파일들은 원래 「수동 적용」 전제였고
 * (V004 주석: `clickhouse-client < V004__events.sql`), 그 결과 운영에서 **120일 동안 한 번도
 * 적용되지 않았다.** 2026-09-14 확인 시 `analytics` DB 는 있는데 그 안에 테이블이 없었고,
 * analytics 파드는 그동안 `Processed 0 total records` 만 찍고 있었다.
 * 소유한 서비스가 자기 스키마를 책임진다.
 *
 * **기동을 막지 않는다.** ClickHouse 가 잠깐 늦게 뜨는 것과 앱이 죽는 것은 다른 문제다 —
 * 실패는 크게 남기고 다음 기동에서 다시 시도한다. 전부 멱등이라 여러 번 돌아도 안전하다.
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
            // 파일명 순서가 곧 적용 순서다 — V005 가 V004 의 표를 다시 세우므로 뒤집히면 안 된다.
            .sortedBy { it.filename }
        if (scripts.isEmpty()) {
            log.warn { "[clickhouse] 적용할 스키마 파일이 없다 — $LOCATION" }
            return
        }

        runCatching {
            dataSource.connection.use { conn ->
                conn.createStatement().use { st ->
                    scripts.forEach { script ->
                        val sql = script.inputStream.bufferedReader().readText()
                        statementsOf(sql).forEach { st.execute(it) }
                        log.info { "[clickhouse] 적용 ${script.filename}" }
                    }
                }
            }
        }.onFailure {
            log.error(it) { "[clickhouse] 스키마 적용 실패 — 다음 기동에서 다시 시도한다" }
        }.onSuccess {
            log.info { "[clickhouse] 스키마 ${scripts.size}개 적용 완료" }
        }
    }

    companion object {
        private const val LOCATION = "clickhouse/analytics"

        /**
         * 한 파일에 여러 문장이 올 수 있다(V005 는 DROP + CREATE). JDBC 는 한 번에 하나만 받는다.
         *
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
