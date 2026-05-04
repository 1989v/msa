package com.kgd.quant.infrastructure.exchange

import com.kgd.quant.application.indicator.IndicatorCalculator
import com.kgd.quant.application.port.market.MarketAdapter
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import io.github.resilience4j.kotlin.ratelimiter.executeSuspendFunction
import io.github.resilience4j.ratelimiter.RateLimiter
import io.github.resilience4j.ratelimiter.RateLimiterConfig
import io.github.resilience4j.ratelimiter.RateLimiterRegistry
import jakarta.annotation.PostConstruct
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * BinanceMarketAdapter — Binance public REST 어댑터 (P2-T01, ADR-0036).
 *
 * Phase 2 범위:
 * - public ticker (`/api/v3/ticker/price`)
 * - candles (`/api/v3/klines`)
 *
 * 인증 0 (public). Resilience4j RateLimiter 1200 weight/min 보수적 적용.
 *
 * 활성화: `quant.binance.enabled=true` (default false). k3s-lite 에선 환경변수로 enable.
 */
@Component
@ConditionalOnProperty(name = ["quant.binance.enabled"], havingValue = "true", matchIfMissing = false)
class BinanceMarketAdapter(
    private val webClientBuilder: WebClient.Builder,
    private val rateLimiterRegistry: RateLimiterRegistry,
) : MarketAdapter {

    private val client = webClientBuilder.baseUrl("https://api.binance.com").build()
    private lateinit var rateLimiter: RateLimiter

    override val market = Market(
        code = MarketCode("BINANCE"),
        supportedClasses = setOf(AssetClass.CRYPTO),
        displayName = "Binance",
    )

    @PostConstruct
    fun init() {
        rateLimiter = rateLimiterRegistry.rateLimiter(
            "binance",
            RateLimiterConfig.custom()
                // 보수적: 1200 weight/min ≈ 20 req/sec — 절반인 10 req/sec 로
                .limitRefreshPeriod(Duration.ofSeconds(1))
                .limitForPeriod(10)
                .timeoutDuration(Duration.ofSeconds(2))
                .build(),
        )
    }

    override fun supports(asset: Asset): Boolean = asset.assetClass == AssetClass.CRYPTO

    override suspend fun latestPrice(asset: Asset): BigDecimal {
        val symbol = BinanceSymbolMapper.toBinanceSymbol(asset.code)
        return rateLimiter.executeSuspendFunction {
            val response = client.get()
                .uri("/api/v3/ticker/price?symbol={s}", symbol)
                .retrieve()
                .bodyToMono(TickerResponse::class.java)
                .awaitSingle()
            BigDecimal(response.price)
        }
    }

    override suspend fun latestPriceAt(asset: Asset): Instant = Instant.now()

    /**
     * Phase 2 — Binance candles. ts/open/high/low/close/volume 만 사용 (다른 필드는 무시).
     *
     * 응답 형식: array of arrays
     * [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
     */
    suspend fun candles(
        asset: Asset,
        interval: String,
        from: Instant,
        to: Instant,
        limit: Int = 500,
    ): List<IndicatorCalculator.Bar> {
        val symbol = BinanceSymbolMapper.toBinanceSymbol(asset.code)
        return rateLimiter.executeSuspendFunction {
            val raw: List<List<Any>> = client.get()
                .uri { it
                    .path("/api/v3/klines")
                    .queryParam("symbol", symbol)
                    .queryParam("interval", toBinanceInterval(interval))
                    .queryParam("startTime", from.toEpochMilli())
                    .queryParam("endTime", to.toEpochMilli())
                    .queryParam("limit", limit)
                    .build()
                }
                .retrieve()
                .bodyToFlux(List::class.java)
                .collectList()
                .awaitSingle()
                .map { @Suppress("UNCHECKED_CAST") (it as List<Any>) }
            raw.map { row ->
                IndicatorCalculator.Bar(
                    ts = Instant.ofEpochMilli((row[0] as Number).toLong()),
                    open = BigDecimal(row[1].toString()),
                    high = BigDecimal(row[2].toString()),
                    low = BigDecimal(row[3].toString()),
                    close = BigDecimal(row[4].toString()),
                    volume = BigDecimal(row[5].toString()),
                )
            }
        }
    }

    private fun toBinanceInterval(interval: String): String = when (interval) {
        "1m", "5m", "15m", "1h", "4h", "1d" -> interval
        else -> "1d"
    }

    private data class TickerResponse(
        val symbol: String = "",
        val price: String = "0",
    )
}
