package com.kgd.quant.application.discover

import com.github.benmanes.caffeine.cache.Cache
import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.quant.application.discover.port.GlobalIndexQuotePort
import com.kgd.quant.application.discover.usecase.GetGlobalIndicesUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.time.Duration

/**
 * GlobalIndicesQuery — 글로벌 지수 마퀴 (8종).
 *
 * 원천 호출은 [GlobalIndexQuotePort] 뒤에 있고, 여기가 갖는 것은 **캐시 TTL 과 실패 흡수**다 —
 * 둘 다 화면 정책이라 원천이 바뀌어도 그대로 남는다.
 */
@Service
class GlobalIndicesQuery(
    private val quotePort: GlobalIndexQuotePort,
    private val properties: QuantChartsProperties,
) : GetGlobalIndicesUseCase {
    private val log = KotlinLogging.logger {}

    private val cache: Cache<String, GlobalIndexQuote> = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(5))
        .maximumSize(100)
        .build()

    override suspend fun fetchAll(): List<GlobalIndexQuote> = coroutineScope {
        properties.globalIndices
            .map { cfg ->
                async { quoteOf(cfg.ticker, cfg.name) }
            }
            .toList()
            .awaitAll()
            .filterNotNull()
    }

    /**
     * USD↔KRW 환율 — ranking currency-normalize 용.
     *
     * `KRW=X` ticker 의 latest price. 외부 호출 실패 시 null → 호출자 fallback.
     */
    override suspend fun usdKrwRate(): BigDecimal? = quoteOf("KRW=X", "USD/KRW")?.price

    private suspend fun quoteOf(ticker: String, displayName: String): GlobalIndexQuote? {
        cache.getIfPresent(ticker)?.let { return it }
        return runCatching { quotePort.fetch(ticker, displayName) }
            .onFailure { log.debug { "index fetch fail ticker=$ticker error=${it.message}" } }
            .getOrNull()
            ?.also { cache.put(ticker, it) }
    }
}
