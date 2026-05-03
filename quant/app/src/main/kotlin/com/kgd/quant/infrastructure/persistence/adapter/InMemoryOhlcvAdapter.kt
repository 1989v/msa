package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant
import kotlin.random.Random

/**
 * ⚠️ TEMPORARY — `OhlcvRepositoryPort` 의 in-memory stub.
 *
 * 정식 구현은 ClickHouse `quant.ohlcv` JDBC adapter (V005) — Phase 1 follow-up.
 * 현재는 deterministic random walk 로 N 봉 생성 (FE 차트 메뉴 검증용).
 */
@Component
class InMemoryOhlcvAdapter : OhlcvRepositoryPort {

    override suspend fun query(
        assetCode: AssetCode,
        marketCode: MarketCode,
        interval: String,
        from: Instant,
        to: Instant,
    ): List<IndicatorCalculator.Bar> {
        val intervalSec = parseIntervalSeconds(interval)
        val bars = mutableListOf<IndicatorCalculator.Bar>()
        var ts = from
        var price = BigDecimal("100.0")
        val seed = (assetCode.value + marketCode.value).hashCode().toLong()
        val rng = Random(seed)
        while (ts.isBefore(to)) {
            val change = BigDecimal(rng.nextDouble(-2.0, 2.0)).setScale(4, java.math.RoundingMode.HALF_UP)
            val open = price
            val close = price.add(change).max(BigDecimal("0.01"))
            val high = listOf(open, close).max().add(BigDecimal(rng.nextDouble(0.0, 0.5)).setScale(4, java.math.RoundingMode.HALF_UP))
            val low = listOf(open, close).min().subtract(BigDecimal(rng.nextDouble(0.0, 0.5)).setScale(4, java.math.RoundingMode.HALF_UP)).max(BigDecimal("0.01"))
            val volume = BigDecimal(rng.nextDouble(100.0, 10000.0)).setScale(4, java.math.RoundingMode.HALF_UP)
            bars.add(IndicatorCalculator.Bar(ts, open, high, low, close, volume))
            price = close
            ts = ts.plusSeconds(intervalSec)
        }
        return bars
    }

    private fun parseIntervalSeconds(interval: String): Long = when (interval) {
        "1m" -> 60
        "5m" -> 300
        "15m" -> 900
        "1h" -> 3600
        "4h" -> 14400
        "1d" -> 86400
        else -> 3600
    }
}
