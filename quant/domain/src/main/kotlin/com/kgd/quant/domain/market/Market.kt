package com.kgd.quant.domain.market

import com.kgd.quant.domain.asset.AssetClass

/**
 * Market — 시세/주문이 발생하는 거래소 또는 데이터 소스 (ADR-0033).
 *
 * - 암호화폐 거래소 — BITHUMB / UPBIT (Phase 1), BINANCE (Phase 2)
 * - 주식 데이터 소스 — YAHOO (US), FDR_KR (KR) — Phase 2
 *
 * `supportedClasses` 는 해당 market 이 다루는 [AssetClass] 집합.
 * 도메인 layer 는 거래소별 인증/페이로드 차이를 모르고 추상 contract 만 본다.
 */
data class Market(
    val code: MarketCode,
    val supportedClasses: Set<AssetClass>,
    val displayName: String,
) {
    init {
        require(supportedClasses.isNotEmpty()) { "Market must support at least one AssetClass" }
        require(displayName.isNotBlank()) { "displayName must not be blank" }
    }

    fun supports(assetClass: AssetClass): Boolean = assetClass in supportedClasses
}
