package com.kgd.quant.infrastructure.chart

import com.kgd.quant.application.chart.PriceStreamPort
import com.kgd.quant.application.port.persistence.OhlcvRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.PriceTick
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant
import kotlin.random.Random

/**
 * StubPricePollingScheduler — TG-13 prototype 폴링 스케줄러.
 *
 * 마지막 ClickHouse OHLCV close 가격 ± 0.3% 무작위 흔들기로 가짜 tick 생성.
 * 실제 yfinance/FDR/빗썸 ws 연동은 별도 PR (TG-15 분봉 ingest 와 동시).
 *
 * 5초 주기 — Phase 3 정통 SSE 도입 전 FE/네트워크 검증용.
 *
 * 활성 비활성: `quant.charts.stream.stub.enabled` (default true, prod 에서는 false 권장).
 */
@Component
class StubPricePollingScheduler(
    private val priceStream: PriceStreamPort,
    private val ohlcvRepo: OhlcvRepositoryPort,
    @Value("\${quant.charts.stream.stub.enabled:true}")
    private val enabled: Boolean,
) {
    private val log = KotlinLogging.logger {}

    /** 활성 구독자 있는 자산만 폴링하기 위해 캐시. */
    private val watchlist = listOf(
        // (asset, market)
        "BTC-USD" to "YAHOO",
        "AAPL" to "YAHOO",
        "005930" to "FDR_KR",
    )

    @Scheduled(fixedDelay = 5_000L)
    fun pollAndPublish() {
        if (!enabled) return
        if (priceStream.totalSubscriberCount() == 0) return

        val now = Instant.now()
        watchlist.forEach { (asset, market) ->
            val a = AssetCode(asset)
            val m = MarketCode(market)
            if (priceStream.subscriberCount(a, m) == 0) return@forEach

            runCatching {
                val basePrice = lastClose(a, m) ?: return@runCatching
                val noise = Random.nextDouble(-0.003, 0.003)
                val price = basePrice.toDouble() * (1.0 + noise)
                priceStream.publish(
                    PriceTick(
                        asset = a,
                        market = m,
                        price = BigDecimal.valueOf(price).setScale(8, java.math.RoundingMode.HALF_UP),
                        ts = now,
                    ),
                )
            }.onFailure {
                log.debug { "stub publish fail asset=$asset market=$market error=${it.message}" }
            }
        }
    }

    private fun lastClose(asset: AssetCode, market: MarketCode): BigDecimal? = runBlocking {
        runCatching {
            val to = Instant.now()
            val from = to.minusSeconds(7L * 24 * 3600)
            val bars = ohlcvRepo.query(asset, market, "1d", from, to)
            bars.lastOrNull()?.close
        }.getOrNull()
    }
}
