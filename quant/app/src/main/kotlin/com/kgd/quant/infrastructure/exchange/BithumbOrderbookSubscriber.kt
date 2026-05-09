package com.kgd.quant.infrastructure.exchange

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.chart.OrderbookPort
import com.kgd.quant.application.port.persistence.AssetCatalogRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.asset.OrderbookLevel
import com.kgd.quant.domain.asset.OrderbookSnapshot
import com.kgd.quant.domain.asset.TradeFill
import com.kgd.quant.domain.asset.TradeSide
import com.kgd.quant.domain.asset.catalog.AssetClass
import com.kgd.quant.domain.market.MarketCode
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import reactor.core.publisher.Flux
import reactor.netty.http.client.HttpClient
import java.math.BigDecimal
import java.time.Instant

/**
 * BithumbOrderbookSubscriber — ADR-0039 PA.
 *
 * 빗썸 Public WebSocket 의 orderbookdepth + transaction 채널 구독 → InMemoryOrderbookStore 에 publish.
 *
 * Activation: `quant.charts.orderbook.bithumb.enabled=true` (default false).
 * 분리 의도: ADR-0036 의 BithumbWebSocketSubscriber (ticker 전용) 와 별도 ws 연결 — 호가 채널 분리.
 *
 * Incremental update (빗썸 의 orderbookdepth 는 변경분만 전송) 의 정확 maintainer 는 후속 PR.
 * 현재 prototype: 매 메시지를 partial snapshot 으로 publish — UI 가 직전 가격대 유지 책임 X (단순 표시).
 * 후속: REST snapshot fetch + ws delta merge + maintainer.
 */
@Component
@ConditionalOnProperty(
    "quant.charts.orderbook.bithumb.enabled",
    havingValue = "true",
    matchIfMissing = false,
)
class BithumbOrderbookSubscriber(
    private val store: OrderbookPort,
    private val objectMapper: ObjectMapper,
    private val assetCatalog: AssetCatalogRepositoryPort,
    @Value("\${quant.charts.orderbook.bithumb.url:wss://pubwss.bithumb.com/pub/ws}")
    private val wsUrl: String,
    /** Fallback (자산 카탈로그 비어있을 때). */
    @Value("\${quant.charts.orderbook.bithumb.fallback-symbols:BTC_KRW,ETH_KRW}")
    private val fallbackSymbolsCsv: String,
) {
    private val log = KotlinLogging.logger {}
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var connectJob: Job? = null

    @PostConstruct
    fun start() {
        connectJob = scope.launch {
            while (isActive) {
                try {
                    connectAndSubscribe()
                } catch (ex: Exception) {
                    log.warn { "bithumb ws connect failed: ${ex.message}" }
                }
                if (!isActive) break
                delay(5_000) // simple fixed-delay reconnect (재연결 정밀화는 후속)
            }
        }
        log.info { "BithumbOrderbookSubscriber started" }
    }

    /**
     * 구독 symbol 목록 — 자산 카탈로그의 active CRYPTO 자산 자동 fetch.
     * assetCode 가 'BTC-USD' 형태 (yfinance pair) → 빗썸 'BTC_KRW' 변환.
     * fallback: 카탈로그 비었거나 fetch 실패 시 fallbackSymbolsCsv.
     */
    private fun resolveSymbols(): List<String> {
        val fromCatalog = runBlocking {
            runCatching {
                assetCatalog.findAll(activeOnly = true)
                    .filter { it.assetClass == AssetClass.CRYPTO }
                    .mapNotNull { item ->
                        // 'BTC-USD' / 'BTC' / 'ETH-USD' → 'BTC_KRW'
                        val base = item.assetCode.substringBefore("-")
                        if (base.isBlank()) null else "${base}_KRW"
                    }
                    .distinct()
            }.getOrElse {
                log.debug { "asset catalog fetch fail: ${it.message}" }
                emptyList()
            }
        }
        if (fromCatalog.isNotEmpty()) return fromCatalog
        return fallbackSymbolsCsv.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }

    @PreDestroy
    fun stop() {
        connectJob?.cancel()
        scope.cancel()
    }

    private suspend fun connectAndSubscribe() {
        val symbols = resolveSymbols()
        if (symbols.isEmpty()) {
            log.warn { "bithumb subscriber: no symbols resolved (catalog empty + fallback empty)" }
            delay(30_000)
            return
        }
        log.info { "bithumb subscribing symbols=$symbols" }
        val subOrderbook = """{"type":"orderbookdepth","symbols":${symbols.toJsonArray()}}"""
        val subTransaction = """{"type":"transaction","symbols":${symbols.toJsonArray()}}"""

        HttpClient.create()
            .websocket()
            .uri(wsUrl)
            .handle { inbound, outbound ->
                val send = outbound.sendString(Flux.just(subOrderbook, subTransaction))
                val receive = inbound.receive().asString().doOnNext { msg ->
                    try {
                        handleMessage(msg)
                    } catch (ex: Exception) {
                        log.debug { "bithumb message parse fail: ${ex.message}" }
                    }
                }
                send.then(receive.then())
            }
            .blockLast() // suspend until disconnect
    }

    private fun handleMessage(msg: String) {
        if (msg.isBlank() || msg.startsWith("{\"status\"")) return // ack messages
        val node = objectMapper.readTree(msg)
        when (node.path("type").asText()) {
            "orderbookdepth" -> handleOrderbook(node)
            "transaction" -> handleTransaction(node)
        }
    }

    private fun handleOrderbook(node: com.fasterxml.jackson.databind.JsonNode) {
        val content = node.path("content")
        val list = content.path("list")
        if (!list.isArray || list.size() == 0) return
        // symbol 별 그룹
        val bySymbol = list.groupBy { it.path("symbol").asText() }
        bySymbol.forEach { (symbol, levels) ->
            val asset = symbol.substringBefore("_")
            val asks = levels
                .filter { it.path("orderType").asText() == "ask" }
                .mapNotNull { it.toLevel() }
                .sortedBy { it.price }
                .take(15)
            val bids = levels
                .filter { it.path("orderType").asText() == "bid" }
                .mapNotNull { it.toLevel() }
                .sortedByDescending { it.price }
                .take(15)
            if (asks.isEmpty() && bids.isEmpty()) return@forEach
            store.publish(
                OrderbookSnapshot(
                    asset = AssetCode(asset),
                    market = MarketCode("BITHUMB"),
                    asks = asks,
                    bids = bids,
                    ts = Instant.now(),
                ),
            )
        }
    }

    private fun handleTransaction(node: com.fasterxml.jackson.databind.JsonNode) {
        val content = node.path("content")
        val list = content.path("list")
        if (!list.isArray) return
        list.forEach { tx ->
            val symbol = tx.path("symbol").asText()
            if (symbol.isBlank()) return@forEach
            val asset = symbol.substringBefore("_")
            val price = runCatching { BigDecimal(tx.path("contPrice").asText()) }.getOrNull() ?: return@forEach
            val qty = runCatching { BigDecimal(tx.path("contQty").asText()) }.getOrNull() ?: return@forEach
            val side = when (tx.path("buySellGb").asText()) {
                "1" -> TradeSide.BUY
                "2" -> TradeSide.SELL
                else -> TradeSide.BUY
            }
            store.publish(
                TradeFill(
                    asset = AssetCode(asset),
                    market = MarketCode("BITHUMB"),
                    price = price,
                    quantity = qty,
                    side = side,
                    ts = Instant.now(),
                ),
            )
        }
    }

    private fun com.fasterxml.jackson.databind.JsonNode.toLevel(): OrderbookLevel? {
        val price = runCatching { BigDecimal(path("price").asText()) }.getOrNull() ?: return null
        val qty = runCatching { BigDecimal(path("quantity").asText()) }.getOrNull() ?: return null
        if (qty.signum() <= 0) return null // 0 quantity = 가격대 제거 신호 (incremental)
        return OrderbookLevel(price, qty)
    }

    private fun List<String>.toJsonArray(): String =
        joinToString(prefix = "[", postfix = "]") { "\"$it\"" }
}
