package com.kgd.quant.application.kimchi

import com.kgd.quant.application.port.fx.FxRateProvider
import com.kgd.quant.application.port.market.MarketAdapter
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.market.MarketCode
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

/**
 * KimchiPremiumCalculator — 빗썸·바이낸스·환율을 합성해 김치프리미엄 산출 (ADR-0036).
 *
 * 어댑터들은 [MarketAdapter] 빈을 ObjectProvider 로 받아 market.code 로 lookup.
 * 빗썸 또는 바이낸스 어댑터가 비활성(@ConditionalOnProperty=false) 인 환경에서는
 * 본 calculator 도 비활성 (호출 시 IllegalStateException).
 */
@Component
class KimchiPremiumCalculator(
    private val adapters: ObjectProvider<MarketAdapter>,
    private val fx: FxRateProvider,
) {
    suspend fun compute(
        asset: Asset,
        krMarketCode: MarketCode,
        foreignMarketCode: MarketCode,
    ): KimchiPremium {
        require(asset.assetClass == AssetClass.CRYPTO) {
            "KimchiPremium 은 CRYPTO 자산만 지원 (got ${asset.assetClass})"
        }
        val krAdapter = adapter(krMarketCode)
        val foreignAdapter = adapter(foreignMarketCode)

        val krwPrice = krAdapter.latestPrice(asset)
        val foreignUsdPrice = foreignAdapter.latestPrice(asset)
        val krwPerUsd = fx.krwPerUsd()

        val foreignKrwEquivalent = foreignUsdPrice.multiply(krwPerUsd)
        val premium = if (foreignKrwEquivalent.signum() == 0) BigDecimal.ZERO
        else krwPrice.subtract(foreignKrwEquivalent)
            .multiply(BigDecimal(100))
            .divide(foreignKrwEquivalent, 4, RoundingMode.HALF_UP)

        return KimchiPremium(
            asset = asset.code,
            krMarket = krMarketCode,
            foreignMarket = foreignMarketCode,
            krwPrice = krwPrice,
            foreignUsdPrice = foreignUsdPrice,
            krwPerUsd = krwPerUsd,
            premiumPercent = premium,
            ts = Instant.now(),
        )
    }

    private fun adapter(code: MarketCode): MarketAdapter {
        return adapters.find { it.market.code == code }
            ?: error("MarketAdapter for ${code.value} not registered (or @ConditionalOnProperty disabled)")
    }
}
