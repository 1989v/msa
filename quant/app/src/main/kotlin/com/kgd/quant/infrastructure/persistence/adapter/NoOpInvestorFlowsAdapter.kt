package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.InvestorFlowsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.InvestorFlow
import com.kgd.quant.domain.market.MarketCode
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * NoOpInvestorFlowsAdapter — ClickHouseInvestorFlowsAdapter 비활성 시 fallback (ADR-0040).
 *
 * query 항상 emptyList → InvestorFlowsPanel 가 'no data' placeholder 표시.
 */
@Component
@ConditionalOnMissingBean(ClickHouseInvestorFlowsAdapter::class)
class NoOpInvestorFlowsAdapter : InvestorFlowsPort {
    override suspend fun query(
        asset: AssetCode,
        market: MarketCode,
        from: Instant,
        to: Instant,
    ): List<InvestorFlow> = emptyList()
}
