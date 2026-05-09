package com.kgd.quant.infrastructure.external

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.application.port.external.NewsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.NewsItem
import com.kgd.quant.domain.asset.NewsKind
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.time.Duration
import java.time.Instant

/**
 * YahooNewsAdapter — Yahoo v1 finance/search API 의 news 부분 (ADR-0041 PA).
 *
 * URL: https://query1.finance.yahoo.com/v1/finance/search?q={ticker}&quotesCount=0&newsCount={limit}
 *
 * 무료, API key 불필요. ~10분 캐시 (뉴스 갱신 빈도 중간).
 * KR 주식은 ticker 변환 (.KS / .KQ) 시도.
 */
@Component
class YahooNewsAdapter(
    private val objectMapper: ObjectMapper,
) : NewsPort {
    private val log = KotlinLogging.logger {}

    private val webClient: WebClient = WebClient.builder()
        .baseUrl("https://query1.finance.yahoo.com")
        .defaultHeader(
            "User-Agent",
            "Mozilla/5.0 (compatible; quant-news/1.0)",
        )
        .build()

    private val cache: Cache<String, List<NewsItem>> = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(10))
        .maximumSize(1_000)
        .build()

    override suspend fun fetch(
        asset: AssetCode,
        market: MarketCode,
        limit: Int,
    ): List<NewsItem> {
        val key = "${asset.value}:${market.value}:$limit"
        cache.getIfPresent(key)?.let { return it }
        val items = fetchUncached(asset, market, limit)
        cache.put(key, items)
        return items
    }

    private suspend fun fetchUncached(
        asset: AssetCode,
        market: MarketCode,
        limit: Int,
    ): List<NewsItem> {
        for (ticker in candidateTickers(asset, market)) {
            val items = runCatching { fetchOne(asset, market, ticker, limit) }.getOrElse {
                log.debug { "yahoo news fail asset=$asset market=$market ticker=$ticker error=${it.message}" }
                null
            } ?: continue
            if (items.isNotEmpty()) return items
        }
        return emptyList()
    }

    private suspend fun fetchOne(
        asset: AssetCode,
        market: MarketCode,
        ticker: String,
        limit: Int,
    ): List<NewsItem> {
        val res = webClient.get()
            .uri { ub ->
                ub.path("/v1/finance/search")
                    .queryParam("q", ticker)
                    .queryParam("quotesCount", 0)
                    .queryParam("newsCount", limit)
                    .build()
            }
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val node = objectMapper.readTree(res)
        val news = node.path("news")
        if (!news.isArray) return emptyList()
        return news.mapNotNull { it.toNewsItem(asset, market) }
    }

    private fun JsonNode.toNewsItem(asset: AssetCode, market: MarketCode): NewsItem? {
        val title = path("title").asText().takeIf { it.isNotBlank() } ?: return null
        val url = path("link").asText().takeIf { it.isNotBlank() } ?: return null
        val source = path("publisher").asText().takeIf { it.isNotBlank() } ?: "Yahoo Finance"
        val publishedAt = path("providerPublishTime").asLong(0L).let {
            if (it > 0) Instant.ofEpochSecond(it) else Instant.now()
        }
        val summary = path("summary").asText().takeIf { it.isNotBlank() }
        return NewsItem(
            asset = asset,
            market = market,
            title = title,
            source = source,
            url = url,
            publishedAt = publishedAt,
            summary = summary,
            kind = NewsKind.NEWS,
        )
    }

    private fun candidateTickers(asset: AssetCode, market: MarketCode): List<String> {
        val a = asset.value
        return when (market.value) {
            "FDR_KR" -> listOf("$a.KS", "$a.KQ", a)
            else -> listOf(a)
        }
    }
}
