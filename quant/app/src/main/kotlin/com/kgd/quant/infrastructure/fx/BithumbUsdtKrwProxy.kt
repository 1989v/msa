package com.kgd.quant.infrastructure.fx

import com.kgd.quant.application.port.fx.FxRateProvider
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * BithumbUsdtKrwProxy — 빗썸 USDT/KRW ticker 를 환율 proxy 로 사용 (ADR-0033 Q4).
 *
 * - 1 분 cache — 동일 시각 내 다중 호출은 캐시 hit
 * - 빗썸 public API: GET /public/ticker/USDT_KRW (인증 0)
 * - 캐시 만료 시 재조회 mutex 로 thundering herd 방어
 *
 * Phase 2+ 에서 ECOS / Open Exchange Rates 어댑터 추가 시 본 클래스는 default 로 유지.
 */
@Component
@ConditionalOnProperty(name = ["quant.fx.provider"], havingValue = "bithumb-proxy", matchIfMissing = true)
class BithumbUsdtKrwProxy(
    private val webClientBuilder: WebClient.Builder,
) : FxRateProvider {

    private val client = webClientBuilder
        .baseUrl("https://api.bithumb.com")
        .build()

    @Volatile
    private var cached: Pair<Instant, BigDecimal>? = null
    private val refreshMutex = Mutex()

    override suspend fun krwPerUsd(at: Instant): BigDecimal {
        val snapshot = cached
        if (snapshot != null && Duration.between(snapshot.first, at).seconds < CACHE_TTL_SECONDS) {
            return snapshot.second
        }
        return refreshMutex.withLock {
            val again = cached
            if (again != null && Duration.between(again.first, at).seconds < CACHE_TTL_SECONDS) {
                return@withLock again.second
            }
            val price = fetchUsdtKrw()
            cached = at to price
            price
        }
    }

    private suspend fun fetchUsdtKrw(): BigDecimal {
        val response = client.get()
            .uri("/public/ticker/USDT_KRW")
            .retrieve()
            .bodyToMono(BithumbTickerResponse::class.java)
            .awaitSingle()
        val closingPrice = response.data.closing_price
        require(closingPrice.isNotBlank()) { "Bithumb USDT_KRW ticker returned empty closing_price" }
        return BigDecimal(closingPrice).also {
            log.debug { "BithumbUsdtKrwProxy fetched USDT/KRW = $it" }
        }
    }

    private data class BithumbTickerResponse(
        val status: String,
        val data: BithumbTickerData,
    )

    private data class BithumbTickerData(
        val closing_price: String,
    )

    companion object {
        private const val CACHE_TTL_SECONDS = 60L
    }
}
