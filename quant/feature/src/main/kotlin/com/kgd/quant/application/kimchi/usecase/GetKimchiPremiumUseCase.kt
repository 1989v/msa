package com.kgd.quant.application.kimchi.usecase

import com.kgd.quant.application.fx.port.FxRateProvider
import com.kgd.quant.application.kimchi.KimchiPremium
import com.kgd.quant.application.market.port.MarketAdapter
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

/** 김치프리미엄 산출 (cross-exchange). */
interface GetKimchiPremiumUseCase {
    suspend fun compute(
        asset: Asset,
        krMarketCode: MarketCode,
        foreignMarketCode: MarketCode,
    ): KimchiPremium
}
