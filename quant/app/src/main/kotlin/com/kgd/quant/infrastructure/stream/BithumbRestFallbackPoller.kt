package com.kgd.quant.infrastructure.stream

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.market.MarketDataHub
import com.kgd.quant.application.port.marketdata.Symbol
import com.kgd.quant.application.port.marketdata.Tick
import com.kgd.quant.application.port.marketdata.TickSource
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.event.EventPublisher
import com.kgd.quant.domain.event.ExchangeConnectionDegraded
import com.kgd.quant.domain.event.ExchangeConnectionRestored
import com.kgd.quant.infrastructure.metrics.QuantMetrics
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
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

private val log = KotlinLogging.logger {}

/**
 * TG-P2-06.3 — WebSocket 단절 시 REST 폴링으로 자동 전환되는 fallback poller.
 *
 * ## 트리거 조건
 * - [BithumbWebSocketSubscriber.currentState] 가 연속 [FALLBACK_THRESHOLD_SECONDS] 초 이상 비-CONNECTED.
 * - 활성 시 매 [POLL_INTERVAL_MS] ms 간격으로 빗썸 REST `/public/ticker/{symbol}` 호출 → [Tick] 정규화 → Hub emit.
 *
 * ## 자동 원복
 * - WS 가 CONNECTED 로 복귀하면 polling 중지 + [ExchangeConnectionRestored] 이벤트 발행.
 * - 진입 시 [ExchangeConnectionDegraded] 이벤트 발행 (reason = `ws_down_${seconds}s`).
 *
 * ## 단순화 / TODO
 * - REST retry / backoff / CircuitBreaker wrap 은 TG-P2-11 에서 통합 적용.
 * - 본 poller 는 골격(state machine + 매초 호출 + Tick 정규화) 만 제공.
 *
 * ## ADR-0020
 * `@Transactional` 금지 — 외부 IO + Hub emit 만 수행.
 */
@Component
@ConditionalOnProperty(
    name = ["quant.market.bithumb-ws.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
class BithumbRestFallbackPoller(
    private val subscriber: BithumbWebSocketSubscriber,
    private val hub: MarketDataHub,
    private val eventPublisher: EventPublisher,
    private val metrics: QuantMetrics,
    private val objectMapper: ObjectMapper,
    @Value("\${quant.market.bithumb-rest.base-url:https://api.bithumb.com}")
    private val baseUrl: String,
    @Value("\${quant.market.bithumb-ws.system-tenant:system}")
    private val systemTenant: String,
) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val pollerJob = AtomicReference<Job?>(null)
    private val disconnectedSince = AtomicReference<Instant?>(null)
    private val webClient: WebClient = WebClient.builder().baseUrl(baseUrl).build()

    @PostConstruct
    fun init() {
        log.info { "BithumbRestFallbackPoller initialized baseUrl=$baseUrl threshold=${FALLBACK_THRESHOLD_SECONDS}s" }
    }

    @PreDestroy
    fun shutdown() {
        log.info { "BithumbRestFallbackPoller shutting down" }
        runCatching { pollerJob.get()?.cancel() }
        runCatching { scope.cancel() }
        pollerJob.set(null)
        disconnectedSince.set(null)
    }

    /**
     * 매초 WS 상태를 확인하고 임계 초과 시 polling 활성, 복구 시 비활성.
     * `@Scheduled(fixedDelay = 1000)` 로 단일 인스턴스 lifecycle 동안 작동.
     */
    @Scheduled(fixedDelayString = "\${quant.market.bithumb-ws.monitor-interval-ms:1000}")
    fun monitorAndPoll() {
        val wsState = subscriber.currentState()
        when (wsState) {
            BithumbWebSocketSubscriber.ConnectionState.CONNECTED -> {
                onWsConnected()
            }
            BithumbWebSocketSubscriber.ConnectionState.DISCONNECTED,
            BithumbWebSocketSubscriber.ConnectionState.CONNECTING,
            BithumbWebSocketSubscriber.ConnectionState.FALLBACK,
            -> {
                onWsNotConnected()
            }
        }
    }

    private fun onWsConnected() {
        if (disconnectedSince.getAndSet(null) != null) {
            log.info { "Bithumb WS reconnected, stopping REST fallback" }
            stopPolling()
            publishRestoredSafe()
        }
    }

    private fun onWsNotConnected() {
        val since = disconnectedSince.get() ?: run {
            val now = Instant.now()
            disconnectedSince.set(now)
            now
        }
        val elapsedSec = Duration.between(since, Instant.now()).seconds
        if (elapsedSec >= FALLBACK_THRESHOLD_SECONDS && pollerJob.get() == null) {
            log.warn { "Bithumb WS down ${elapsedSec}s, activating REST fallback poller" }
            publishDegradedSafe("ws_down_${elapsedSec}s")
            startPolling()
        }
    }

    private fun startPolling() {
        val job = scope.launch {
            while (isActive) {
                subscriber.symbols.forEach { symbol ->
                    runCatching {
                        val tick = fetchTickViaRest(symbol)
                        if (tick != null) {
                            metrics.marketTickReceived(BithumbWebSocketSubscriber.EXCHANGE, symbol, TickSource.REST.name)
                            hub.emit(tick)
                        }
                    }.onFailure { ex ->
                        log.warn { "REST fallback poll failed symbol=$symbol reason=${ex.message}" }
                    }
                }
                delay(POLL_INTERVAL_MS)
            }
        }
        pollerJob.set(job)
        // gauge: fallback 활성 표시
        metrics.setWsConnectionState(
            BithumbWebSocketSubscriber.EXCHANGE,
            BithumbWebSocketSubscriber.STATE_FALLBACK,
        )
    }

    private fun stopPolling() {
        runCatching { pollerJob.getAndSet(null)?.cancel() }
    }

    private suspend fun fetchTickViaRest(symbol: String): Tick? {
        val raw: String? = webClient.get()
            .uri("/public/ticker/{symbol}", symbol)
            .retrieve()
            .bodyToMono(String::class.java)
            .awaitSingle()
        return raw?.let { parseRestTick(symbol, it) }
    }

    /**
     * 빗썸 REST ticker 응답 파싱 (단순화). 실 schema:
     * `{"status":"0000","data":{"closing_price":"30000000","units_traded":"1.5", ...}}`
     */
    private fun parseRestTick(symbol: String, body: String): Tick? {
        val node: JsonNode = runCatching { objectMapper.readTree(body) }.getOrNull() ?: return null
        if (node.path("status").asText() != "0000") return null
        val data = node.path("data")
        if (data.isMissingNode || data.isNull) return null

        val priceText = data.path("closing_price").asText().takeIf { it.isNotBlank() } ?: return null
        val volumeText = data.path("units_traded").asText().ifBlank { "0" }

        val price = runCatching { BigDecimal(priceText) }.getOrNull() ?: return null
        val volume = runCatching { BigDecimal(volumeText) }.getOrDefault(BigDecimal.ZERO)

        return Tick(
            symbol = Symbol(symbol),
            price = price,
            volume = volume,
            timestamp = Instant.now(),
            source = TickSource.REST,
        )
    }

    private fun publishDegradedSafe(reason: String) {
        runCatching {
            runBlocking {
                eventPublisher.publish(
                    ExchangeConnectionDegraded(
                        eventId = UUID.randomUUID(),
                        occurredAt = Instant.now(),
                        tenantId = TenantId(systemTenant),
                        exchange = Exchange.BITHUMB,
                        reason = reason,
                    ),
                )
            }
        }.onFailure { ex -> log.warn { "publish ExchangeConnectionDegraded failed reason=${ex.message}" } }
    }

    private fun publishRestoredSafe() {
        runCatching {
            runBlocking {
                eventPublisher.publish(
                    ExchangeConnectionRestored(
                        eventId = UUID.randomUUID(),
                        occurredAt = Instant.now(),
                        tenantId = TenantId(systemTenant),
                        exchange = Exchange.BITHUMB,
                    ),
                )
            }
        }.onFailure { ex -> log.warn { "publish ExchangeConnectionRestored failed reason=${ex.message}" } }
    }

    companion object {
        const val FALLBACK_THRESHOLD_SECONDS = 10L
        const val POLL_INTERVAL_MS = 1_000L
    }
}
