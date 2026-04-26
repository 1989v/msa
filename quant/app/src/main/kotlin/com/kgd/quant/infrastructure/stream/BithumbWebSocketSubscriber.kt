package com.kgd.quant.infrastructure.stream

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.market.MarketDataHub
import com.kgd.quant.application.port.marketdata.MarketDataSubscriber
import com.kgd.quant.application.port.marketdata.Symbol
import com.kgd.quant.application.port.marketdata.Tick
import com.kgd.quant.application.port.marketdata.TickSource
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.event.EventPublisher
import com.kgd.quant.domain.event.ExchangeConnectionDegraded
import com.kgd.quant.domain.event.ExchangeConnectionRestored
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import com.kgd.quant.infrastructure.resilience.CircuitBreakerConfiguration
import io.github.oshai.kotlinlogging.KotlinLogging
import io.github.resilience4j.circuitbreaker.CallNotPermittedException
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.kotlin.circuitbreaker.executeSuspendFunction
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import reactor.core.publisher.Mono
import reactor.netty.http.client.HttpClient
import reactor.netty.http.websocket.WebsocketInbound
import reactor.netty.http.websocket.WebsocketOutbound
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private val log = KotlinLogging.logger {}

/**
 * TG-P2-06 — 빗썸 Public WebSocket 시세 구독자.
 *
 * ## 책임
 * - `wss://pubwss.bithumb.com/pub/ws` 연결 + ticker 채널 구독.
 * - 수신 페이로드 → [Tick] 정규화 (source = [TickSource.WS]) → [MarketDataHub.emit].
 * - 단절 감지 시 5s 이내 재연결 (지수 백오프 1s → 2s → 5s 상한).
 * - 10s 연속 단절은 [BithumbRestFallbackPoller] 가 별도 모니터링 → REST 폴백.
 * - 도메인 이벤트 발행: [ExchangeConnectionDegraded] / [ExchangeConnectionRestored].
 *
 * ## TG-P2-11 — CircuitBreaker 적용
 * 재연결 호출 (`connectAndSubscribe`) 은 [bithumbWsReconnectCircuitBreaker] (ADR-0015 §1, name=`bithumb-ws-reconnect`) 로 wrap.
 * CB OPEN 시 [CallNotPermittedException] 가 throw 되어 재연결 시도가 short-circuit 되며,
 * 30s waitDurationInOpenState 후 half-open 전이로 자연 복구된다.
 *
 * ## Activation
 * `quant.market.bithumb-ws.enabled=true` 일 때만 bean 생성 (Phase 2 default false).
 * Phase 1 백테스트 / 통합 테스트는 본 컴포넌트를 활성화하지 않는다.
 *
 * ## ADR-0020 / ADR-0025
 * WS 콜백 → Hub.emit 경로에 `@Transactional` 금지. 시세 hot path 보호.
 *
 * ## 단순화 / TODO
 * - 빗썸 ticker JSON schema 정확 매핑은 TG-P2-08 통합 시점에 보강한다.
 *   본 구현은 wire-up + 재연결 backoff 검증을 우선한다.
 * - gzip 압축 / heartbeat ping-pong 처리는 TG-P2-06.1 후속 PR.
 * - JWT 인증은 Public 채널이라 불필요 (TG-P2-02 Errata 대상은 Private 채널).
 */
@Component
@ConditionalOnProperty(
    name = ["quant.market.bithumb-ws.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
class BithumbWebSocketSubscriber(
    private val hub: MarketDataHub,
    private val eventPublisher: EventPublisher,
    private val metrics: QuantMetrics,
    private val objectMapper: ObjectMapper,
    @Qualifier(CircuitBreakerConfiguration.BEAN_BITHUMB_WS_RECONNECT_CB)
    private val bithumbWsReconnectCircuitBreaker: CircuitBreaker,
    @Value("\${quant.market.bithumb-ws.url:wss://pubwss.bithumb.com/pub/ws}")
    private val wsUrl: String,
    @Value("\${quant.market.bithumb-ws.symbols:BTC_KRW,ETH_KRW}")
    private val symbolsCsv: String,
    @Value("\${quant.market.bithumb-ws.system-tenant:system}")
    private val systemTenant: String,
) : MarketDataSubscriber {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var connectionJob: Job? = null
    private val state = AtomicReference(ConnectionState.DISCONNECTED)
    private val previousState = AtomicReference(ConnectionState.DISCONNECTED)

    val symbols: List<String> by lazy {
        symbolsCsv.split(",").map { it.trim() }.filter { it.isNotBlank() }
    }

    /** 외부 노출 — [BithumbRestFallbackPoller] 가 10s 단절 판단에 사용. */
    fun currentState(): ConnectionState = state.get()

    @PostConstruct
    fun start() {
        if (connectionJob != null) return
        log.info { "BithumbWebSocketSubscriber starting symbols=$symbols url=$wsUrl" }
        metrics.setWsConnectionState(EXCHANGE, STATE_DISCONNECTED)
        connectionJob = scope.launch { connectionLoop() }
    }

    @PreDestroy
    fun stop() {
        log.info { "BithumbWebSocketSubscriber stopping" }
        runCatching { connectionJob?.cancel() }
        runCatching { scope.cancel() }
        connectionJob = null
        state.set(ConnectionState.DISCONNECTED)
        metrics.setWsConnectionState(EXCHANGE, STATE_DISCONNECTED)
    }

    /**
     * 연결 lifecycle 루프.
     * - 연결 성공 → suspend 한 채로 in-bound 메시지 처리.
     * - 단절 / 예외 → 지수 백오프 후 재시도.
     * - 코루틴 cancel 시 즉시 종료.
     */
    private suspend fun connectionLoop() {
        var backoffMs = INITIAL_BACKOFF_MS
        while (currentCoroutineContext().isActive) {
            transition(ConnectionState.CONNECTING)
            try {
                // TG-P2-11: bithumb-ws-reconnect CB 로 wrap. CB OPEN 시 CallNotPermittedException → backoff 후 재시도.
                bithumbWsReconnectCircuitBreaker.executeSuspendFunction {
                    connectAndSubscribe()
                }
                // 정상 종료(서버 측 close) → 즉시 재시도, backoff reset
                backoffMs = INITIAL_BACKOFF_MS
                transition(ConnectionState.DISCONNECTED)
                log.info { "Bithumb WS session ended cleanly, will reconnect" }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: CallNotPermittedException) {
                metrics.wsReconnectAttempt(EXCHANGE, OUTCOME_FAIL)
                log.warn { "Bithumb WS reconnect short-circuited (CB open) backoff=${backoffMs}ms" }
                transition(ConnectionState.DISCONNECTED)
            } catch (e: Exception) {
                metrics.wsReconnectAttempt(EXCHANGE, OUTCOME_FAIL)
                log.warn { "Bithumb WS connection failed reason=${e.message} backoff=${backoffMs}ms" }
                transition(ConnectionState.DISCONNECTED)
                publishDegradedSafe(e.message ?: "unknown")
            }
            delay(backoffMs)
            backoffMs = (backoffMs * 2).coerceAtMost(MAX_BACKOFF_MS)
        }
    }

    /**
     * reactor-netty `HttpClient.websocket()` 으로 연결을 맺고 in-bound stream 을 [handleInbound] 로 처리.
     * suspend 함수가 정상 complete (Mono empty) 또는 error 로 종료될 때까지 대기.
     */
    private suspend fun connectAndSubscribe() {
        suspendCancellableCoroutine<Unit> { cont ->
            val disposable = HttpClient.create()
                .websocket()
                .uri(wsUrl)
                .handle { inbound, outbound -> handleSession(inbound, outbound) }
                .subscribe(
                    { /* per-message onNext 는 inbound stream 내부에서 처리 — 여기는 무시 */ },
                    { ex -> if (cont.isActive) cont.resumeWithException(ex) },
                    { if (cont.isActive) cont.resume(Unit) },
                )
            cont.invokeOnCancellation { runCatching { disposable.dispose() } }
        }
    }

    private fun handleSession(inbound: WebsocketInbound, outbound: WebsocketOutbound): Mono<Void> {
        val subscribeMessage = buildSubscribeMessage()
        // 연결 직후 구독 메시지 전송 + in-bound 수신 시작
        val send: Mono<Void> = outbound.sendString(Mono.just(subscribeMessage)).then()
        val receive: Mono<Void> = inbound.receive()
            .asString()
            .doOnSubscribe {
                transition(ConnectionState.CONNECTED)
                metrics.wsReconnectAttempt(EXCHANGE, OUTCOME_SUCCESS)
                publishRestoredSafe()
            }
            .doOnNext { msg -> handleInbound(msg) }
            .then()
        return send.then(receive)
    }

    private fun buildSubscribeMessage(): String {
        // 빗썸 ticker 구독 메시지 (ADR-0024 §9 — public 채널, 인증 불필요)
        val symbolsJson = symbols.joinToString(",") { "\"$it\"" }
        return """{"type":"ticker","symbols":[$symbolsJson],"tickTypes":["1H"]}"""
    }

    /**
     * in-bound 메시지 핸들러.
     *
     * 단순화: 빗썸 ticker JSON schema 의 핵심 필드만 파싱한다 (`type`, `content.symbol`, `content.closePrice`,
     * `content.volume`, `content.date`+`content.time` 또는 `content.contDtm`). schema 실측 확정은
     * TG-P2-08 통합 시 보강.
     */
    private fun handleInbound(rawMessage: String) {
        try {
            val tick = parseTick(rawMessage) ?: return
            metrics.marketTickReceived(EXCHANGE, tick.symbol.value, TickSource.WS.name)
            hub.emit(tick)
        } catch (e: Exception) {
            // payload 자체는 로그 금지 (민감정보 방어 아니지만 카디널리티 보호)
            log.warn { "Bithumb WS tick parse failed reason=${e.message}" }
        }
    }

    private fun parseTick(rawMessage: String): Tick? {
        val node: JsonNode = runCatching { objectMapper.readTree(rawMessage) }.getOrNull() ?: return null
        // 구독 ack / 기타 메시지 무시
        if (node.path("type").asText().lowercase() != "ticker") return null
        val content = node.path("content")
        if (content.isMissingNode || content.isNull) return null

        val symbolText = content.path("symbol").asText().takeIf { it.isNotBlank() } ?: return null
        val priceText = content.path("closePrice").asText().takeIf { it.isNotBlank() } ?: return null
        val volumeText = content.path("volume").asText().ifBlank { "0" }

        val price = runCatching { BigDecimal(priceText) }.getOrNull() ?: return null
        val volume = runCatching { BigDecimal(volumeText) }.getOrDefault(BigDecimal.ZERO)

        return Tick(
            symbol = Symbol(symbolText),
            price = price,
            volume = volume,
            timestamp = Instant.now(),
            source = TickSource.WS,
        )
    }

    private fun transition(next: ConnectionState) {
        val prev = state.getAndSet(next)
        previousState.set(prev)
        val gauge = when (next) {
            ConnectionState.CONNECTED -> STATE_CONNECTED
            ConnectionState.CONNECTING, ConnectionState.DISCONNECTED -> STATE_DISCONNECTED
            ConnectionState.FALLBACK -> STATE_FALLBACK
        }
        metrics.setWsConnectionState(EXCHANGE, gauge)
    }

    /** publish 가 suspend 라 reactor 콜백 안에서 호출하기 위해 runBlocking + best-effort. */
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
        // 직전 상태가 DISCONNECTED 인 경우에만 발행 (CONNECTING → CONNECTED 첫 진입 포함)
        val prev = previousState.get()
        if (prev == ConnectionState.CONNECTED) return
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

    // --- MarketDataSubscriber 인터페이스 구현 ---

    /**
     * Hub 의 stream 을 symbol 기준으로 필터링하여 노출.
     * 직접 구독 경로 (테스트/대안 소비자) 가 사용한다. Phase 2 기본 경로는 [MarketDataHub.asFlow] 직접 구독.
     */
    override fun subscribe(symbol: Symbol): Flow<Tick> = flow {
        hub.asFlow().filter { it.symbol == symbol }.collect { emit(it) }
    }

    /**
     * REST 폴백 경로 — 본 구독자는 직접 처리하지 않고 [BithumbRestFallbackPoller] 가 담당한다.
     * 호환성 유지를 위해 동일 hub 의 REST 라벨 tick 만 필터링하여 노출.
     */
    override fun fallbackPoll(symbol: Symbol): Flow<Tick> = flow {
        hub.asFlow()
            .filter { it.symbol == symbol && it.source == TickSource.REST }
            .collect { emit(it) }
    }

    /** WebSocket 연결 상태 enum. */
    enum class ConnectionState {
        DISCONNECTED,
        CONNECTING,
        CONNECTED,

        /** REST 폴백이 활성화된 상태 — [BithumbRestFallbackPoller] 가 setter 로 전환. */
        FALLBACK,
    }

    companion object {
        const val EXCHANGE = "bithumb"
        const val OUTCOME_SUCCESS = "success"
        const val OUTCOME_FAIL = "fail"

        const val STATE_DISCONNECTED = 0
        const val STATE_FALLBACK = 1
        const val STATE_CONNECTED = 2

        const val INITIAL_BACKOFF_MS = 1_000L
        const val MAX_BACKOFF_MS = 5_000L
    }
}
