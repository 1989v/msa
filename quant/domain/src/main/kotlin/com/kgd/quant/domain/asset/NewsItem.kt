package com.kgd.quant.domain.asset

import com.kgd.quant.domain.market.MarketCode
import java.time.Instant

/**
 * NewsItem — ADR-0041 뉴스/공시 단위.
 *
 * 라이선스: 제목 + summary + 원문 link 만 표시 (full content 표시 X).
 * Source: Yahoo v8 search news (US/CRYPTO), DART OpenDART (KR 공시) — 별도 PR.
 */
data class NewsItem(
    val asset: AssetCode,
    val market: MarketCode,
    val title: String,
    val source: String,        // "Yahoo Finance" / "DART" / ...
    val url: String,
    val publishedAt: Instant,
    val summary: String? = null,
    val kind: NewsKind,
)

enum class NewsKind {
    NEWS,
    DISCLOSURE,
}
