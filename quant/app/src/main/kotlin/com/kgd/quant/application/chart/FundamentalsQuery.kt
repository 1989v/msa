package com.kgd.quant.application.chart

import com.kgd.quant.application.port.external.FundamentalsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.Fundamentals
import com.kgd.quant.domain.market.MarketCode
import org.springframework.stereotype.Service

/**
 * FundamentalsQuery — 종목 기초 데이터 조회 use case.
 *
 * 단순 read-through. 캐싱은 어댑터 (Caffeine) 책임.
 */
@Service
class FundamentalsQuery(
    private val port: FundamentalsPort,
) {
    suspend fun fundamentals(asset: AssetCode, market: MarketCode): Fundamentals? {
        return port.fetch(asset, market)
    }
}
