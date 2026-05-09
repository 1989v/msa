package com.kgd.quant.application.port.external

import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.NewsItem
import com.kgd.quant.domain.market.MarketCode

/**
 * NewsPort — ADR-0041 뉴스/공시 외부 source.
 *
 * 자산 클래스별 source 분리:
 * - YAHOO market: YahooNewsAdapter (US 뉴스)
 * - FDR_KR market: NaverNewsAdapter (뉴스) + DartDisclosureAdapter (공시)
 * - CRYPTO: YahooNewsAdapter 또는 미지원
 */
interface NewsPort {
    suspend fun fetch(asset: AssetCode, market: MarketCode, limit: Int = 20): List<NewsItem>
}
