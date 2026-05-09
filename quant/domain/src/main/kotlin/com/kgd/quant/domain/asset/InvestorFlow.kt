package com.kgd.quant.domain.asset

import com.kgd.quant.domain.market.MarketCode
import java.time.LocalDate

/**
 * InvestorFlow — 매매주체별 일별 순매수 (외국인/기관/개인) — ADR-0040.
 *
 * KR 주식 전용 (market=FDR_KR). pykrx ingest 가 적재.
 * 단위: 주(stock count). 양수=순매수, 음수=순매도.
 */
data class InvestorFlow(
    val asset: AssetCode,
    val market: MarketCode,
    val tradeDate: LocalDate,
    val individualNet: Long,
    val foreignNet: Long,
    val institutionNet: Long,
)
