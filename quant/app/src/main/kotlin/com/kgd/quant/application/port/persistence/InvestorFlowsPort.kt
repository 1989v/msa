package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.InvestorFlow
import com.kgd.quant.domain.market.MarketCode
import java.time.Instant

/**
 * InvestorFlowsPort — `quant.investor_flows` read-only port (ADR-0040).
 *
 * pykrx ingest sidecar 가 INSERT, 메인 서비스는 read.
 */
interface InvestorFlowsPort {
    suspend fun query(
        asset: AssetCode,
        market: MarketCode,
        from: Instant,
        to: Instant,
    ): List<InvestorFlow>
}
