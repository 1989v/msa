package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.kimchi.KimchiPremium
import com.kgd.quant.application.kimchi.KimchiPremiumCalculator
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * KimchiPremiumController — `/api/v1/charts/kimchi-premium` (ADR-0036 P2-T10).
 */
@RestController
@RequestMapping("/api/v1/charts/kimchi-premium")
class KimchiPremiumController(
    private val calculator: KimchiPremiumCalculator,
) {
    @GetMapping
    suspend fun current(
        @RequestParam asset: String,
        @RequestParam(defaultValue = "BITHUMB") krMarket: String,
        @RequestParam(defaultValue = "BINANCE") foreignMarket: String,
    ): ApiResponse<KimchiPremium> {
        val a = Asset(
            code = AssetCode(asset),
            assetClass = AssetClass.CRYPTO,
            displayName = asset,
        )
        val result = calculator.compute(a, MarketCode(krMarket), MarketCode(foreignMarket))
        return ApiResponse.success(result)
    }
}
