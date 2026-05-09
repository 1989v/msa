package com.kgd.quant.domain.asset

import com.kgd.quant.domain.market.MarketCode
import java.math.BigDecimal
import java.time.Instant

/**
 * Fundamentals — 종목 기초 데이터 (시총·PER·배당 등).
 *
 * Yahoo Finance v10 quoteSummary 의 summaryDetail + defaultKeyStatistics 를 병합한 형태.
 * 모든 필드 nullable — 외부 source 가 일부 필드를 제공하지 않을 수 있음 (예: CRYPTO 는 PER 없음).
 *
 * 의도적 제약:
 * - 시계열 데이터 아님 (ClickHouse 미사용). MySQL 또는 in-memory 캐시.
 * - asOf 는 외부 source 가 마지막 갱신한 시각 (또는 우리 캐시 fetch 시각).
 */
data class Fundamentals(
    val asset: AssetCode,
    val market: MarketCode,
    /** 시가총액 (자산 통화 — STOCK_KR=원, STOCK_US=USD, CRYPTO=USD). */
    val marketCap: BigDecimal? = null,
    /** Trailing P/E ratio. CRYPTO/일부 종목 null. */
    val peRatio: BigDecimal? = null,
    /** Trailing EPS. */
    val eps: BigDecimal? = null,
    /** 배당수익률 (소수점 — 0.0043 = 0.43%). */
    val dividendYield: BigDecimal? = null,
    /** Beta vs benchmark (보통 S&P500 또는 KOSPI). */
    val beta: BigDecimal? = null,
    /** 52주 최고가. */
    val weeks52High: BigDecimal? = null,
    /** 52주 최저가. */
    val weeks52Low: BigDecimal? = null,
    /** 일평균 거래량 (3개월). */
    val avgDailyVolume: BigDecimal? = null,
    /** 외부 source 마지막 갱신 또는 우리 fetch 시각. */
    val asOf: Instant,
)
