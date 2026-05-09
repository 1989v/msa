package com.kgd.quant.infrastructure.external

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.math.BigDecimal

/**
 * YahooLatestPriceAdapter — Yahoo v8 chart API 의 `meta.regularMarketPrice` 호출.
 *
 * 실시간이 아닌 ~15분 지연 가격 (US 무료 tier 제약).
 * SSE polling 의 source 로 사용 (TG-13/14 prototype 의 stub random 대체).
 *
 * Ticker 변환 (FundamentalsAdapter 와 동일 정책):
 * - YAHOO market: asset 그대로 (예: AAPL, BTC-USD)
 * - FDR_KR market: asset + ".KS" / ".KQ" 순차
 */
@Component
class YahooLatestPriceAdapter(
    private val objectMapper: ObjectMapper,
) {
    private val log = KotlinLogging.logger {}

    private val webClient: WebClient = WebClient.builder()
        .baseUrl("https://query2.finance.yahoo.com")
        .defaultHeader(
            "User-Agent",
            "Mozilla/5.0 (compatible; quant-latest-price/1.0)",
        )
        .build()

    /** @return 마지막 가격. null = 데이터 없음 또는 외부 source 응답 실패. */
    suspend fun latest(asset: AssetCode, market: MarketCode): BigDecimal? {
        for (ticker in candidateTickers(asset, market)) {
            val price = runCatching { fetchOne(ticker) }.getOrElse {
                log.debug { "yahoo latest fail asset=$asset market=$market ticker=$ticker error=${it.message}" }
                null
            }
            if (price != null) return price
        }
        return null
    }

    private suspend fun fetchOne(ticker: String): BigDecimal? {
        val res = webClient.get()
            .uri { ub ->
                ub.path("/v8/finance/chart/$ticker")
                    .queryParam("interval", "1m")
                    .queryParam("range", "1d")
                    .build()
            }
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val node = objectMapper.readTree(res)
        val result = node.path("chart").path("result")
        if (!result.isArray || result.size() == 0) return null
        val meta = result[0].path("meta")
        return readBigDecimal(meta, "regularMarketPrice")
            ?: readBigDecimal(meta, "previousClose")
    }

    private fun candidateTickers(asset: AssetCode, market: MarketCode): List<String> {
        val a = asset.value
        return when (market.value) {
            "FDR_KR" -> listOf("$a.KS", "$a.KQ")
            else -> listOf(a)
        }
    }

    private fun readBigDecimal(parent: JsonNode, field: String): BigDecimal? {
        val n = parent.path(field)
        if (n.isMissingNode || n.isNull || !n.isNumber) return null
        return BigDecimal(n.asText())
    }
}
