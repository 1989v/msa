package com.kgd.quant.application.port.external

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.Fundamentals
import com.kgd.quant.domain.market.MarketCode

/**
 * FundamentalsPort — 종목 기초 데이터 외부 source.
 *
 * 구현체:
 * - YahooFundamentalsAdapter (Yahoo Finance v10 quoteSummary)
 * - 후속: KRX/NaverPay/FDR 보강 (KR 종목 정확도 향상)
 *
 * null 반환 = 데이터 없음 (CRYPTO 등). 예외는 IO 실패에만 던진다.
 */
interface FundamentalsPort {
    suspend fun fetch(asset: AssetCode, market: MarketCode): Fundamentals?
}
