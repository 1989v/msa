package com.kgd.quant.infrastructure.clickhouse

import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import java.sql.Connection

/**
 * quant DDL 을 classpath 에서 버전 순으로 읽어 JDBC Connection 에 적용한다.
 *
 * - 운영 기동([QuantSchemaInitializer])과 Testcontainers 스모크 테스트에서 동일 경로를 재사용한다.
 * - 파일 목록은 손으로 적지 않고 `clickhouse/quant/V*.sql` 을 훑는다. 손 목록은 V004 에서 멈춘 채
 *   V012 까지 파일이 쌓였고, 운영에는 애초에 아무것도 적용되지 않은 채 123일이 지났다 (2026-09-17).
 * - **각 파일은 한 번만 돈다.** `quant.schema_migrations` 에 적용한 파일명을 남기고 있는 것은
 *   건너뛴다. IF NOT EXISTS 는 CREATE 만 멱등으로 만들 뿐이라, DROP 을 담은 파일이 들어오는 날
 *   재기동마다 데이터가 지워진다 — analytics 원장이 실제로 세 번 지워졌다.
 * - ClickHouse JDBC 는 한 Statement 에 여러 문장을 지원하지 않을 수 있어 `;` 로 분리 후 개별 실행한다.
 * - `--` 로 시작하는 라인 주석은 실행 전에 제거한다 (문자열 리터럴 내 `--` 는 현재 DDL 에 없음을 파일 레벨에서 보장).
 */
class SchemaBootstrapper {

    /** DDL classpath 경로를 버전 순으로 반환. 파일명이 곧 적용 순서다 (V001, V002, …). */
    fun ddlResourcePaths(): List<String> =
        PathMatchingResourcePatternResolver()
            .getResources("classpath*:$LOCATION/V*.sql")
            .mapNotNull { it.filename }
            .sorted()
            .map { "/$LOCATION/$it" }

    /**
     * 아직 적용하지 않은 DDL 을 순서대로 실행하고 새로 적용한 파일 수를 돌려준다.
     * 실패 시 즉시 예외 전파 — 성공한 파일까지만 이력에 남으므로 다음 기동이 그 파일부터 다시 한다.
     */
    fun applyTo(conn: Connection): Int {
        conn.createStatement().use { stmt ->
            // 이력 표가 quant DB 안에 있으니 DB 부터 있어야 한다 (V001 과 같은 문장, 멱등).
            stmt.execute("CREATE DATABASE IF NOT EXISTS quant")
            stmt.execute(CREATE_HISTORY)
            val applied = stmt.executeQuery("SELECT version FROM $HISTORY").use { rs ->
                generateSequence { if (rs.next()) rs.getString(1) else null }.toSet()
            }

            var ran = 0
            ddlResourcePaths().forEach { path ->
                val name = path.substringAfterLast('/')
                if (name in applied) return@forEach
                val raw = this::class.java.getResourceAsStream(path)
                    ?.bufferedReader()
                    ?.use { it.readText() }
                    ?: error("DDL not found on classpath: $path")
                statementsOf(raw).forEach { sql -> stmt.execute(sql) }
                stmt.execute("INSERT INTO $HISTORY (version) VALUES ('${name.replace("'", "''")}')")
                ran++
            }
            return ran
        }
    }

    companion object {
        const val LOCATION = "clickhouse/quant"
        const val HISTORY = "quant.schema_migrations"

        private const val CREATE_HISTORY = """
            CREATE TABLE IF NOT EXISTS $HISTORY
            (
                version    String,
                applied_at DateTime DEFAULT now()
            )
            ENGINE = MergeTree
            ORDER BY version
        """

        /** 라인 주석을 걷어낸 뒤 세미콜론으로 문장을 나눈다. 주석 안의 `;` 가 문장을 잘못 끊지 않게. */
        fun statementsOf(sql: String): List<String> =
            sql.lineSequence()
                .map { line -> line.substringBefore("--") }
                .joinToString("\n")
                .split(";")
                .map { it.trim() }
                .filter { it.isNotBlank() }
    }
}
