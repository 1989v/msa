package com.kgd.quant.application.discover

import java.math.BigDecimal

/** ADR-0042 — 발견·트렌딩 ranking entry. */
data class MarketRanking(
    val asset: String,
    val market: String,
    val assetClass: String,
    val displayName: String,
    val lastClose: BigDecimal,
    val prevClose: BigDecimal?,
    val changePct: BigDecimal?,
    /** 거래대금 = sum(volume * close) over ranking window (default 1d). */
    val turnover: BigDecimal,
    /** 거래량 = sum(volume) over ranking window. */
    val volume: BigDecimal,
)

enum class RankingMode {
    TURNOVER,   // 거래대금 (default)
    VOLUME,     // 거래량
    GAINERS,    // 상승률 상위
    LOSERS,     // 하락률 상위 (음수 큰 순)
}

/** 글로벌 지수 마퀴 entry. */
data class GlobalIndexQuote(
    val ticker: String,
    val displayName: String,
    val price: BigDecimal,
    val prevClose: BigDecimal?,
    val changePct: BigDecimal?,
)
