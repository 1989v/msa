package com.kgd.quant.application.port.persistence

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.time.Instant

/**
 * OhlcvRepositoryPort — ClickHouse `quant.ohlcv` read-only port.
 *
 * 메인 서비스는 INSERT 하지 않는다 — Python ingest sidecar 가 단방향으로 적재 (ADR-0034).
 */
interface OhlcvRepositoryPort {
    suspend fun query(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
    ): List<IndicatorCalculator.Bar>
}
