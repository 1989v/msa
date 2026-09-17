package com.kgd.quant.infrastructure.clickhouse

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import java.sql.Connection

private val log = KotlinLogging.logger {}

/**
 * 기동 시 quant ClickHouse 스키마를 적용한다.
 *
 * **사람 손을 전제하지 않는다.** [SchemaBootstrapper] 는 테스트만 부르고 있었고, 그 결과 운영
 * ClickHouse 에 `quant` DB 가 한 번도 만들어지지 않았다 — sideapp 의 커넥션 풀은 하루 9,000번
 * `Database quant does not exist` 를 받으며 재접속했고, quant-ingest CronJob 11개는 123일 동안
 * 한 줄도 적재하지 못한 채 성공으로 끝났다 (2026-09-17). 소유한 서비스가 자기 스키마를 책임진다.
 *
 * **풀의 커넥션을 쓰지 않는다.** 풀은 URL 의 `/quant` 를 세션 DB 로 잡는데, 그 DB 가 없으면
 * 접속 자체가 거부되어 `CREATE DATABASE` 를 보낼 수 없다 — 첫 배포가 정확히 그렇게 실패했다.
 * 부트스트랩은 항상 있는 `system` 을 세션 DB 로 따로 접속한다([bootstrapUrl]). DDL 은 전부
 * `quant.` 로 한정돼 있어 세션 DB 가 무엇이든 같은 곳에 만든다.
 *
 * **기동을 막지 않는다.** 이 JVM 에는 chatbot·gifticon 이 함께 있다. ClickHouse 가 늦게 뜨면
 * 로그만 남기고, 다음 기동이 다시 시도한다.
 */
class QuantSchemaInitializer(
    private val openConnection: () -> Connection,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun apply() {
        runCatching {
            openConnection().use { conn -> SchemaBootstrapper().applyTo(conn) }
        }.onSuccess { ran ->
            log.info { "[quant-clickhouse] 스키마 ${ran}개 새로 적용" }
        }.onFailure {
            log.error(it) { "[quant-clickhouse] 스키마 적용 실패 — 다음 기동에서 다시 시도한다" }
        }
    }

    companion object {
        /** `jdbc:clickhouse://host:port/quant?k=v` → `jdbc:clickhouse://host:port/system?k=v`. */
        fun bootstrapUrl(url: String): String {
            val authorityEnd = url.indexOf('/', url.indexOf("//") + 2).takeIf { it >= 0 } ?: url.length
            val query = url.indexOf('?').takeIf { it >= 0 }?.let { url.substring(it) } ?: ""
            return url.substring(0, authorityEnd) + "/system" + query
        }
    }
}
