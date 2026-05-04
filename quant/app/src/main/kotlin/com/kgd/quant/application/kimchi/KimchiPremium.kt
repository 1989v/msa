package com.kgd.quant.application.kimchi

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.time.Instant

/**
 * KimchiPremium — 국내 거래소(KRW) ↔ 해외 거래소(USD) 동일 자산의 가격 차이 (ADR-0036).
 *
 * premium% = (krwPrice - foreignUsdPrice × krwPerUsd) / (foreignUsdPrice × krwPerUsd) × 100
 *
 * + 양수 → 국내가 비쌈 (프리미엄)
 * - 음수 → 국내가 쌈 (디스카운트)
 */
data class KimchiPremium(
    val asset: AssetCode,
    val krMarket: MarketCode,
    val foreignMarket: MarketCode,
    val krwPrice: BigDecimal,
    val foreignUsdPrice: BigDecimal,
    val krwPerUsd: BigDecimal,
    val premiumPercent: BigDecimal,
    val ts: Instant,
)
