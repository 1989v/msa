package com.kgd.quant.application.discover

import com.fasterxml.jackson.databind.ObjectMapper
import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.infrastructure.config.QuantChartsProperties
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Duration

/**
 * GlobalIndicesQuery — 토스급 글로벌 지수 마퀴 (8종).
 *
 * Yahoo v8 chart API 의 meta.regularMarketPrice + chartPreviousClose 호출.
 * Caffeine 캐시 5분 (지수는 갱신 빈도 중간).
 */
@Service
class GlobalIndicesQuery(
    private val objectMapper: ObjectMapper,
    private val properties: QuantChartsProperties,
) {
    private val log = KotlinLogging.logger {}

    private val webClient: WebClient = WebClient.builder()
        .baseUrl("https://query2.finance.yahoo.com")
        .defaultHeader(
            "User-Agent",
            "Mozilla/5.0 (compatible; quant-discover/1.0)",
        )
        .build()

    private val cache: Cache<String, GlobalIndexQuote> = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(5))
        .maximumSize(100)
        .build()

    suspend fun fetchAll(): List<GlobalIndexQuote> = coroutineScope {
        properties.globalIndices
            .map { cfg ->
                val ticker = cfg.ticker
                val name = cfg.name
                async {
                    cache.getIfPresent(ticker) ?: runCatching {
                        val q = fetchOne(ticker, name)
                        if (q != null) cache.put(ticker, q)
                        q
                    }.onFailure {
                        log.debug { "index fetch fail ticker=$ticker error=${it.message}" }
                    }.getOrNull()
                }
            }
            .toList()
            .awaitAll()
            .filterNotNull()
    }

    private suspend fun fetchOne(ticker: String, name: String): GlobalIndexQuote? {
        val res = webClient.get()
            .uri { ub ->
                ub.path("/v8/finance/chart/$ticker")
                    .queryParam("interval", "1d")
                    .queryParam("range", "5d")
                    .build()
            }
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val node = objectMapper.readTree(res)
        val result = node.path("chart").path("result")
        if (!result.isArray || result.size() == 0) return null
        val r0 = result[0]
        val meta = r0.path("meta")
        val price = meta.path("regularMarketPrice").let {
            if (it.isMissingNode || !it.isNumber) null else BigDecimal(it.asText())
        } ?: return null
        val prev = meta.path("chartPreviousClose").let {
            if (it.isMissingNode || !it.isNumber) null else BigDecimal(it.asText())
        }
        val changePct = if (prev != null && prev.signum() > 0) {
            (price - prev).divide(prev, MathContext.DECIMAL64).setScale(6, RoundingMode.HALF_UP)
        } else {
            null
        }
        return GlobalIndexQuote(
            ticker = ticker,
            displayName = name,
            price = price,
            prevClose = prev,
            changePct = changePct,
        )
    }
}
