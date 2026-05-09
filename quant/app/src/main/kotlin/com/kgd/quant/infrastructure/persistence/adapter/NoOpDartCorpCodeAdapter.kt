package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.DartCorpCodePort
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.stereotype.Component

/**
 * NoOpDartCorpCodeAdapter — ClickHouseDartCorpCodeAdapter 가 비활성 (ClickHouse JdbcTemplate 미설정) 일 때 fallback.
 *
 * findCorpCode 항상 null → DartDisclosureAdapter 가 emptyList 반환 (DART 호출 skip).
 */
@Component
@ConditionalOnMissingBean(ClickHouseDartCorpCodeAdapter::class)
class NoOpDartCorpCodeAdapter : DartCorpCodePort {
    override suspend fun findCorpCode(stockCode: String): String? = null
}
