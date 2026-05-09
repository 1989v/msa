package com.kgd.quant.infrastructure.external

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.application.port.external.FundamentalsPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.Fundamentals
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.util.Optional

/**
 * YahooFundamentalsAdapter — Yahoo Finance v10 quoteSummary 호출.
 *
 * URL: https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}
 * Modules: summaryDetail, defaultKeyStatistics
 *
 * Ticker 변환:
 * - STOCK_US (YAHOO market): asset 그대로 (예: AAPL)
 * - STOCK_KR (FDR_KR market): asset + ".KS" (KOSPI) 또는 ".KQ" (KOSDAQ) — KOSPI 우선 시도, 실패 시 KQ
 * - CRYPTO: Yahoo crypto pair 형식 (예: BTC-USD) — 이미 backendAssetOf 가 변환
 *
 * 캐시: 종목당 TTL 1h (가격이 아니라 기초 데이터라 빈도 낮음).
 */
@Component
class YahooFundamentalsAdapter(
    private val objectMapper: ObjectMapper,
) : FundamentalsPort {
    private val log = KotlinLogging.logger {}

    private val webClient: WebClient = WebClient.builder()
        .baseUrl("https://query2.finance.yahoo.com")
        .defaultHeader(
            "User-Agent",
            "Mozilla/5.0 (compatible; quant-fundamentals/1.0)",
        )
        .build()

    /** Caffeine sync cache — TTL 1h, max 5000 종목. Optional 로 negative cache 도 보관. */
    private val cache: Cache<String, Optional<Fundamentals>> = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofHours(1))
        .maximumSize(5_000)
        .build()

    override suspend fun fetch(asset: AssetCode, market: MarketCode): Fundamentals? {
        val key = "${asset.value}:${market.value}"
        cache.getIfPresent(key)?.let { return it.orElse(null) }
        // Miss — concurrent miss 시 동일 key 가 여러 번 fetch 가능하나 idempotent IO 라 허용.
        val value = fetchUncached(asset, market)
        cache.put(key, Optional.ofNullable(value))
        return value
    }

    private suspend fun fetchUncached(asset: AssetCode, market: MarketCode): Fundamentals? {
        val tickers = candidateTickers(asset, market)
        for (t in tickers) {
            // v10 quoteSummary 는 crumb 인증 필요 → 보통 401. 시도하되 fail 시 v8 fallback.
            val json = runCatching { fetchYahoo(t) }.getOrElse { null }
            if (json != null) return parse(asset, market, json)
            // v8 chart meta fallback — partial fundamentals (52W H/L + price + volume).
            val meta = runCatching { fetchYahooChartMeta(t) }.getOrElse {
                log.debug { "yahoo v8 meta fail asset=$asset market=$market ticker=$t error=${it.message}" }
                null
            }
            if (meta != null) return parseFromMeta(asset, market, meta)
        }
        return null
    }

    private suspend fun fetchYahooChartMeta(ticker: String): JsonNode? {
        val res = webClient.get()
            .uri { ub ->
                ub.path("/v8/finance/chart/$ticker")
                    .queryParam("range", "1d")
                    .queryParam("interval", "1d")
                    .build()
            }
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val node = objectMapper.readTree(res)
        val result = node.path("chart").path("result")
        if (!result.isArray || result.size() == 0) return null
        val meta = result[0].path("meta")
        return if (meta.isMissingNode || meta.isNull) null else meta
    }

    private fun parseFromMeta(asset: AssetCode, market: MarketCode, meta: JsonNode): Fundamentals {
        return Fundamentals(
            asset = asset,
            market = market,
            marketCap = null,
            peRatio = null,
            eps = null,
            dividendYield = null,
            beta = null,
            weeks52High = numberOrNull(meta.path("fiftyTwoWeekHigh")),
            weeks52Low = numberOrNull(meta.path("fiftyTwoWeekLow")),
            avgDailyVolume = numberOrNull(meta.path("regularMarketVolume")),
            asOf = Instant.now(),
        )
    }

    private fun numberOrNull(n: JsonNode): BigDecimal? {
        if (n.isMissingNode || n.isNull || !n.isNumber) return null
        return BigDecimal(n.asText())
    }

    /** Yahoo ticker 후보 — KR 은 .KS / .KQ 둘 다 시도. */
    private fun candidateTickers(asset: AssetCode, market: MarketCode): List<String> {
        val a = asset.value
        return when (market.value) {
            "FDR_KR" -> listOf("$a.KS", "$a.KQ")
            // YAHOO market 은 backendAssetOf 가 이미 BTC-USD 같은 pair 만들어 보냄
            else -> listOf(a)
        }
    }

    private suspend fun fetchYahoo(ticker: String): JsonNode? {
        val res = webClient.get()
            .uri { ub ->
                ub.path("/v10/finance/quoteSummary/$ticker")
                    .queryParam("modules", "summaryDetail,defaultKeyStatistics")
                    .build()
            }
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val node = objectMapper.readTree(res)
        val result = node.path("quoteSummary").path("result")
        if (!result.isArray || result.size() == 0) return null
        return result[0]
    }

    private fun parse(asset: AssetCode, market: MarketCode, root: JsonNode): Fundamentals {
        val sd = root.path("summaryDetail")
        val ks = root.path("defaultKeyStatistics")
        return Fundamentals(
            asset = asset,
            market = market,
            marketCap = raw(sd, "marketCap"),
            peRatio = raw(sd, "trailingPE"),
            eps = raw(ks, "trailingEps"),
            dividendYield = raw(sd, "dividendYield"),
            beta = raw(sd, "beta"),
            weeks52High = raw(sd, "fiftyTwoWeekHigh"),
            weeks52Low = raw(sd, "fiftyTwoWeekLow"),
            avgDailyVolume = raw(sd, "averageDailyVolume3Month"),
            asOf = Instant.now(),
        )
    }

    /** Yahoo 의 `{raw, fmt, longFmt}` 객체에서 raw 추출. 없으면 null. */
    private fun raw(parent: JsonNode, field: String): BigDecimal? {
        val n = parent.path(field).path("raw")
        if (n.isMissingNode || n.isNull) return null
        if (!n.isNumber) return null
        return BigDecimal(n.asText())
    }
}
