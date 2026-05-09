package com.kgd.quant.infrastructure.external

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.NewsItem
import com.kgd.quant.domain.asset.NewsKind
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * DartDisclosureAdapter — KR 전자공시 (OpenDART).
 *
 * https://opendart.fss.or.kr — API key 필요 (`DART_API_KEY` 환경변수).
 * 미설정 시 비활성 (emptyList).
 *
 * corp_code (DART 회사 고유번호) 는 stock_code 와 다름. Phase A 는 대표 6 종목 하드코딩.
 * 후속: DART 의 corpCode.xml zip 다운로드 + DB 매핑 (별도 ingest job).
 */
@Component
class DartDisclosureAdapter(
    private val objectMapper: ObjectMapper,
    @Value("\${quant.charts.dart.api-key:}")
    private val apiKey: String,
) {
    private val log = KotlinLogging.logger {}

    private val webClient: WebClient = WebClient.builder()
        .baseUrl("https://opendart.fss.or.kr")
        .build()

    private val cache: Cache<String, List<NewsItem>> = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(15))
        .maximumSize(500)
        .build()

    /** Phase A 하드코딩 매핑. 후속에 DB 매핑 도입. */
    private val CORP_CODE_BY_STOCK = mapOf(
        "005930" to "00126380",  // 삼성전자
        "000660" to "00164779",  // SK하이닉스
        "035420" to "00266961",  // NAVER
        "035720" to "00258801",  // 카카오
        "005380" to "00164742",  // 현대차
        "207940" to "00877059",  // 삼성바이오로직스
    )

    suspend fun fetch(asset: AssetCode, market: MarketCode, limit: Int = 20): List<NewsItem> {
        if (apiKey.isBlank()) return emptyList()
        if (market.value != "FDR_KR") return emptyList()
        val corpCode = CORP_CODE_BY_STOCK[asset.value] ?: return emptyList()
        val key = "$corpCode:$limit"
        cache.getIfPresent(key)?.let { return it }
        val items = runCatching { fetchUncached(asset, market, corpCode, limit) }.getOrElse {
            log.debug { "dart fetch fail asset=$asset error=${it.message}" }
            emptyList()
        }
        cache.put(key, items)
        return items
    }

    private suspend fun fetchUncached(
        asset: AssetCode,
        market: MarketCode,
        corpCode: String,
        limit: Int,
    ): List<NewsItem> {
        // 최근 30일
        val today = LocalDate.now(ZoneOffset.UTC)
        val from = today.minusDays(30)
        val fmt = DateTimeFormatter.ofPattern("yyyyMMdd")
        val res = webClient.get()
            .uri { ub ->
                ub.path("/api/list.json")
                    .queryParam("crtfc_key", apiKey)
                    .queryParam("corp_code", corpCode)
                    .queryParam("bgn_de", from.format(fmt))
                    .queryParam("end_de", today.format(fmt))
                    .queryParam("page_count", limit)
                    .build()
            }
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val node = objectMapper.readTree(res)
        if (node.path("status").asText() != "000") return emptyList()
        val list = node.path("list")
        if (!list.isArray) return emptyList()
        return list.mapNotNull { it.toNewsItem(asset, market) }
    }

    private fun JsonNode.toNewsItem(asset: AssetCode, market: MarketCode): NewsItem? {
        val title = path("report_nm").asText().takeIf { it.isNotBlank() } ?: return null
        val rceptNo = path("rcept_no").asText().takeIf { it.isNotBlank() } ?: return null
        val rceptDt = path("rcept_dt").asText().takeIf { it.length == 8 } ?: return null
        val publishedAt = runCatching {
            LocalDate.parse(rceptDt, DateTimeFormatter.ofPattern("yyyyMMdd"))
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant()
        }.getOrElse { Instant.now() }
        val flrNm = path("flr_nm").asText().takeIf { it.isNotBlank() }
        val url = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=$rceptNo"
        return NewsItem(
            asset = asset,
            market = market,
            title = title,
            source = "DART (전자공시)",
            url = url,
            publishedAt = publishedAt,
            summary = flrNm?.let { "제출인 $it" },
            kind = NewsKind.DISCLOSURE,
        )
    }
}
