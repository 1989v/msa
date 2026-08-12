package com.kgd.common.startup

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.annotation.Bean
import org.springframework.context.event.EventListener
import javax.sql.DataSource

private val log = KotlinLogging.logger {}

/**
 * 기동 시 데이터소스를 한 번 깨워 둔다 (ADR-0068).
 *
 * `readinessProbe` 가 보는 `/actuator/health/readiness` 는 애플리케이션 상태만 보고하고
 * DB 를 건드리지 않는다. 그래서 **쿼리를 한 번도 실행해 보지 않은 채 Ready** 가 되고,
 * 첫 사용자 요청이 커넥션 생성·드라이버 초기화·JIT 을 전부 뒤집어쓴다.
 *
 * [ApplicationReadyEvent] 를 **동기 리스너**로 받는다. 이 리스너가 끝나야 Boot 이 가용성
 * 상태를 ACCEPTING_TRAFFIC 으로 올리므로, 워밍업 자체가 readiness 게이트가 된다 —
 * 별도 상태 플래그를 둘 필요가 없다.
 *
 * 범위는 **커넥션 획득 1회**까지다. 주요 엔드포인트 예열 같은 것은 하지 않는다 —
 * 무엇이 주요한지는 계속 바뀌고 기동 시간만 늘어난다.
 */
@AutoConfiguration
@ConditionalOnClass(DataSource::class)
@ConditionalOnProperty(
    prefix = "kgd.common.warmup",
    name = ["enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class DataSourceWarmupAutoConfiguration {

    @Bean
    fun dataSourceWarmup(dataSources: List<DataSource>) = DataSourceWarmup(dataSources)
}

class DataSourceWarmup(private val dataSources: List<DataSource>) {

    /**
     * 실패해도 기동을 막지 않는다. 워밍업은 최적화이지 정합성 요건이 아니다 —
     * DB 일시 장애가 배포 실패로 번지면 안 된다. 대신 조용히 느려지지 않도록 로그를 남긴다.
     */
    @EventListener(ApplicationReadyEvent::class)
    fun warmUp() {
        if (dataSources.isEmpty()) return

        val startedAt = System.currentTimeMillis()
        var ok = 0
        dataSources.forEach { dataSource ->
            runCatching {
                dataSource.connection.use { it.isValid(WARMUP_VALIDATION_TIMEOUT_SECONDS) }
            }.onSuccess { ok++ }
                .onFailure { e ->
                    log.warn { "DataSource warmup failed — 첫 요청이 느려질 수 있다: ${e.message}" }
                }
        }
        log.info {
            "DataSource warmup ${ok}/${dataSources.size} in ${System.currentTimeMillis() - startedAt}ms"
        }
    }

    private companion object {
        const val WARMUP_VALIDATION_TIMEOUT_SECONDS = 5
    }
}
