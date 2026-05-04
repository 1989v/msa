package com.kgd.quant.infrastructure.exchange

import com.kgd.quant.application.port.market.MarketAdapter
import com.kgd.quant.domain.asset.Asset
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.market.Market
import com.kgd.quant.domain.market.MarketCode
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.math.BigDecimal
import java.time.Instant

/**
 * BithumbMarketAdapter — 빗썸 public ticker 어댑터 (MarketAdapter 구현, ADR-0036 P2-B).
 *
 * 기존 PaperExchangeAdapter / Phase 1 빗썸 WebSocket 코드는 자동매매(주문) 영역.
 * 본 어댑터는 차트 분석 / 김치프리미엄 계산용 read-only ticker.
 *
 * 활성화: `quant.bithumb.market-adapter.enabled=true` (default true, k3s-lite enable).
 */
@Component
@ConditionalOnProperty(
    name = ["quant.bithumb.market-adapter.enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class BithumbMarketAdapter(
    private val webClientBuilder: WebClient.Builder,
) : MarketAdapter {

    private val client = webClientBuilder.baseUrl("https://api.bithumb.com").build()

    override val market = Market(
        code = MarketCode("BITHUMB"),
        supportedClasses = setOf(AssetClass.CRYPTO),
        displayName = "Bithumb",
    )

    override fun supports(asset: Asset): Boolean = asset.assetClass == AssetClass.CRYPTO

    override suspend fun latestPrice(asset: Asset): BigDecimal {
        val symbol = asset.code.value.uppercase() + "_KRW"
        val res = client.get()
            .uri("/public/ticker/{s}", symbol)
            .retrieve()
            .bodyToMono(TickerResponse::class.java)
            .awaitSingle()
        require(res.data.closing_price.isNotBlank()) {
            "Bithumb ticker $symbol returned empty closing_price"
        }
        return BigDecimal(res.data.closing_price)
    }

    override suspend fun latestPriceAt(asset: Asset): Instant = Instant.now()

    private data class TickerResponse(
        val status: String = "",
        val data: TickerData = TickerData(),
    )

    private data class TickerData(
        val closing_price: String = "",
    )
}
