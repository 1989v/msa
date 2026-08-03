package com.kgd.place.infrastructure.opensearch

import com.kgd.place.application.poi.port.PoiIndexPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component

/**
 * 기동 시 poi 인덱스를 보장(best-effort). OpenSearch 가 일시 불가해도 앱 부팅은 막지 않는다.
 * PlaceSeedRunner(@Order 2)보다 먼저 실행되어 시드 색인 대상 인덱스를 준비한다.
 */
@Component
@Order(1)
class PoiIndexInitializer(
    private val poiIndexPort: PoiIndexPort,
) : ApplicationRunner {

    private val log = KotlinLogging.logger {}

    override fun run(args: ApplicationArguments) {
        runCatching { poiIndexPort.ensureIndex() }
            .onFailure { log.warn(it) { "poi 인덱스 보장 실패 — POI 검색은 인덱스 준비 후 동작" } }
    }
}
