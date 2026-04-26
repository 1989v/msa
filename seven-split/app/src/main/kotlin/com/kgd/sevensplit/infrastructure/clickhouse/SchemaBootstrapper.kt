package com.kgd.sevensplit.infrastructure.clickhouse

import java.sql.Connection

/**
 * TG-06: seven_split DDL 을 classpath 에서 버전 순으로 읽어 JDBC Connection 에 적용한다.
 *
 * - 운영/로컬 부트스트랩과 Testcontainers 스모크 테스트에서 동일 경로를 재사용한다.
 * - ClickHouse JDBC 는 한 Statement 에 여러 문장을 지원하지 않을 수 있어 `;` 로 분리 후 개별 실행한다.
 * - `--` 로 시작하는 라인 주석은 실행 전에 제거한다 (문자열 리터럴 내 `--` 는 현재 DDL 에 없음을 파일 레벨에서 보장).
 */
class SchemaBootstrapper {

    /** DDL 파일 경로를 버전 순으로 반환. 테스트/운영에서 재사용. */
    fun ddlResourcePaths(): List<String> = listOf(
        "/clickhouse/seven_split/V001__create_database.sql",
        "/clickhouse/seven_split/V002__market_tick_bithumb.sql",
        "/clickhouse/seven_split/V003__backtest_run.sql",
        "/clickhouse/seven_split/V004__execution_result_placeholder.sql",
    )

    /** 순서대로 DDL 실행. 실패 시 즉시 예외 전파 (idempotent: IF NOT EXISTS 전제). */
    fun applyTo(conn: Connection) {
        ddlResourcePaths().forEach { path ->
            val raw = this::class.java.getResourceAsStream(path)
                ?.bufferedReader()
                ?.use { it.readText() }
                ?: error("DDL not found on classpath: $path")

            // 라인 단위 주석 제거 후 세미콜론 분리.
            val cleaned = raw.lineSequence()
                .map { line -> line.substringBefore("--") }
                .joinToString("\n")

            conn.createStatement().use { stmt ->
                cleaned.split(";")
                    .map { it.trim() }
                    .filter { it.isNotBlank() }
                    .forEach { sql -> stmt.execute(sql) }
            }
        }
    }
}
