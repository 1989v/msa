package com.kgd.quant.infrastructure.clickhouse

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.jdbc.core.JdbcTemplate

private val log = KotlinLogging.logger {}

/**
 * 기동 시 quant ClickHouse 스키마를 적용한다.
 *
 * **사람 손을 전제하지 않는다.** [SchemaBootstrapper] 는 테스트만 부르고 있었고, 그 결과 운영
 * ClickHouse 에 `quant` DB 가 한 번도 만들어지지 않았다 — sideapp 의 커넥션 풀은 하루 9,000번
 * `Database quant does not exist` 를 받으며 재접속했고, quant-ingest CronJob 11개는 123일 동안
 * 한 줄도 적재하지 못한 채 성공으로 끝났다 (2026-09-17). 소유한 서비스가 자기 스키마를 책임진다.
 *
 * **기동을 막지 않는다.** 이 JVM 에는 chatbot·gifticon 이 함께 있다. ClickHouse 가 늦게 뜨면
 * 로그만 남기고, 다음 기동이 다시 시도한다.
 */
class QuantSchemaInitializer(
    private val jdbc: JdbcTemplate,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun apply() {
        runCatching {
            val ds = requireNotNull(jdbc.dataSource) { "quant ClickHouse DataSource 가 없다" }
            ds.connection.use { conn -> SchemaBootstrapper().applyTo(conn) }
        }.onSuccess { ran ->
            log.info { "[quant-clickhouse] 스키마 ${ran}개 새로 적용" }
        }.onFailure {
            log.error(it) { "[quant-clickhouse] 스키마 적용 실패 — 다음 기동에서 다시 시도한다" }
        }
    }
}
