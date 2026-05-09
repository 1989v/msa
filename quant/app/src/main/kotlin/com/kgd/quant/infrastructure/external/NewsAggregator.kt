package com.kgd.quant.infrastructure.external

import com.kgd.quant.application.port.external.NewsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.NewsItem
import com.kgd.quant.domain.market.MarketCode
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Component

/**
 * NewsAggregator — 자산 클래스별 news source 합성.
 *
 * - YahooNewsAdapter: 글로벌 뉴스 (US/CRYPTO/KR ticker 매핑)
 * - DartDisclosureAdapter: KR 공시 (FDR_KR + DART_API_KEY 활성 시)
 *
 * @Primary 로 NewsPort 의 우선 구현체. ChartController.newsPort 가 본 클래스 inject.
 */
@Component
@Primary
class NewsAggregator(
    private val yahoo: YahooNewsAdapter,
    private val dart: DartDisclosureAdapter,
    private val naver: NaverNewsAdapter,
) : NewsPort {
    override suspend fun fetch(
        asset: AssetCode,
        market: MarketCode,
        limit: Int,
    ): List<NewsItem> = coroutineScope {
        val yahooDeferred = async { yahoo.fetch(asset, market, limit) }
        val dartDeferred = async { dart.fetch(asset, market, limit) }
        val naverDeferred = async { naver.fetch(asset, market, limit) }
        val merged = (yahooDeferred.await() + dartDeferred.await() + naverDeferred.await())
            .sortedByDescending { it.publishedAt }
            .distinctBy { it.url }
            .take(limit)
        merged
    }
}
