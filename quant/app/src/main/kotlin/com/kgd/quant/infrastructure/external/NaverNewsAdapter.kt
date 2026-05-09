package com.kgd.quant.infrastructure.external

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.application.port.persistence.AssetCatalogRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.NewsItem
import com.kgd.quant.domain.asset.NewsKind
import com.kgd.quant.domain.asset.catalog.AssetClass
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.time.Duration
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * NaverNewsAdapter — Naver Search API 의 news.json 호출 (ADR-0041 정밀화).
 *
 * https://openapi.naver.com/v1/search/news.json?query={종목명}&display={limit}&sort=date
 * Headers: X-Naver-Client-Id, X-Naver-Client-Secret
 *
 * 무료, 일일 25,000건 한도. API key 미설정 시 비활성.
 * KR 주식 (FDR_KR) 만 — query 는 자산 카탈로그의 displayName (예: '삼성전자').
 */
@Component
class NaverNewsAdapter(
    private val objectMapper: ObjectMapper,
    private val assetCatalog: AssetCatalogRepositoryPort,
    @Value("\${quant.charts.naver.client-id:}")
    private val clientId: String,
    @Value("\${quant.charts.naver.client-secret:}")
    private val clientSecret: String,
) {
    private val log = KotlinLogging.logger {}

    private val webClient: WebClient = WebClient.builder()
        .baseUrl("https://openapi.naver.com")
        .build()

    private val cache: Cache<String, List<NewsItem>> = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(10))
        .maximumSize(2_000)
        .build()

    /** RFC822 → Instant. Naver 의 pubDate 형식: "Mon, 09 May 2026 14:23:55 +0900". */
    private val rfc822: DateTimeFormatter = DateTimeFormatter.RFC_1123_DATE_TIME

    suspend fun fetch(asset: AssetCode, market: MarketCode, limit: Int = 20): List<NewsItem> {
        if (clientId.isBlank() || clientSecret.isBlank()) return emptyList()
        if (market.value != "FDR_KR") return emptyList()
        val query = resolveQuery(asset) ?: return emptyList()
        val key = "$query:$limit"
        cache.getIfPresent(key)?.let { return it }
        val items = runCatching { fetchUncached(asset, market, query, limit) }.getOrElse {
            log.debug { "naver news fail asset=$asset query=$query error=${it.message}" }
            emptyList()
        }
        cache.put(key, items)
        return items
    }

    /** asset_code 로 자산 카탈로그 displayName 조회 — query 키워드. */
    private suspend fun resolveQuery(asset: AssetCode): String? {
        return runCatching {
            assetCatalog.findByClassAndCode(AssetClass.STOCK_KR, asset.value)?.displayName
        }.getOrNull() ?: asset.value
    }

    private suspend fun fetchUncached(
        asset: AssetCode,
        market: MarketCode,
        query: String,
        limit: Int,
    ): List<NewsItem> {
        val res = webClient.get()
            .uri { ub ->
                ub.path("/v1/search/news.json")
                    .queryParam("query", query)
                    .queryParam("display", limit)
                    .queryParam("sort", "date")
                    .build()
            }
            .header("X-Naver-Client-Id", clientId)
            .header("X-Naver-Client-Secret", clientSecret)
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val node = objectMapper.readTree(res)
        val items = node.path("items")
        if (!items.isArray) return emptyList()
        return items.mapNotNull { it.toNewsItem(asset, market) }
    }

    private fun JsonNode.toNewsItem(asset: AssetCode, market: MarketCode): NewsItem? {
        val title = path("title").asText().takeIf { it.isNotBlank() }?.let(::stripHtmlTags)
            ?: return null
        val url = path("originallink").asText().takeIf { it.isNotBlank() }
            ?: path("link").asText().takeIf { it.isNotBlank() }
            ?: return null
        val description = path("description").asText().takeIf { it.isNotBlank() }
            ?.let(::stripHtmlTags)
        val publishedAt = runCatching {
            val s = path("pubDate").asText()
            ZonedDateTime.parse(s, rfc822).toInstant()
        }.getOrElse { Instant.now() }
        return NewsItem(
            asset = asset,
            market = market,
            title = title,
            source = "Naver",
            url = url,
            publishedAt = publishedAt,
            summary = description,
            kind = NewsKind.NEWS,
        )
    }

    /** Naver 응답 의 <b>...</b> 같은 highlight 태그 제거. */
    private fun stripHtmlTags(s: String): String =
        s.replace(Regex("<[^>]+>"), "")
            .replace("&quot;", "\"")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&apos;", "'")
}
