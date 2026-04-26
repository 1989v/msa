package com.kgd.quant.infrastructure.metrics

import com.kgd.quant.application.port.notification.NotificationPriority
import com.kgd.quant.application.port.notification.NotificationPriorityQueue
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * TG-14.2: Quant Phase 1 Micrometer facade.
 *
 * Phase 1 subset 메트릭:
 *  - `quant_backtest_run_total{status}` — 백테스트 성공/실패 누적 카운터
 *  - `quant_backtest_run_duration_seconds` — 백테스트 소요 시간 타이머 (p50/p95/p99 자동 히스토그램)
 *  - `quant_strategy_evaluation_latency_seconds{mode}` — 전략 평가 루프 지연 (backtest 모드 전용 Phase 1)
 *  - `quant_ingest_bithumb_rows_total{symbol}` — 빗썸 히스토리 수집 insert 건수
 *
 * Phase 2 추가 메트릭 (TG-P2-03 KEK 캐시):
 *  - `quant_kek_cache_hits_total` — DEK 캐시 hit 누적
 *  - `quant_kek_cache_misses_total` — DEK 캐시 miss 누적 (KMS 호출 발생)
 *  - `quant_kek_cache_stale_total` — KMS 일시 장애 시 만료 entry 재사용 누적
 *
 * Phase 2 추가 메트릭 (TG-P2-04 lazy re-encryption):
 *  - `quant_kek_rotation_lazy_reencrypt_total{from_version,to_version,table}` —
 *    회전 잡이 row 1건을 새 KEK 로 재암호화 성공한 누적 건수.
 *
 * Phase 2 추가 메트릭 (TG-P2-05 audit chain):
 *  - `quant_audit_log_appended_total` — audit_log row append 성공 누적
 *  - `quant_audit_hash_chain_invalid_total` — AuditChainVerifier 가 invalid 검출한 row 수
 *
 * Phase 2 추가 메트릭 (TG-P2-06 / TG-P2-07 시세 hot path):
 *  - `quant_market_tick_received_total{exchange,symbol,source}` — 수신한 Tick 누적 (source ∈ WS/REST)
 *  - `quant_ws_reconnect_attempts_total{exchange,outcome}` — WebSocket 재연결 시도 (outcome ∈ success/fail)
 *  - `quant_ws_connection_state{exchange}` — gauge 0=disconnected / 1=fallback / 2=connected
 *  - `quant_market_hub_dropped_total{reason}` — SharedFlow tryEmit 실패 (DROP_OLDEST 발생)
 *  - `quant_market_hub_kafka_publish_failure_total` — Kafka fan-out collector 발행 실패
 *
 * Phase 2 추가 메트릭 (TG-P2-10 Telegram notification):
 *  - `quant_notification_send_latency_seconds{channel,priority}` — 발송 latency 타이머
 *  - `quant_notification_send_failure_total{channel,reason}` — 발송 실패 누적
 *  - `quant_notification_queue_depth{priority}` — gauge, 큐 대기 건수 (NotificationPriorityQueue.size)
 *
 * Gauge `quant_outbox_pending_rows` 는 라이프사이클이 다르므로 [OutboxPendingMetric] 참조.
 *
 * ## 사용 규칙 (ADR-0021)
 * - API key / Bot token / 평문 credential 을 **태그 값으로 절대 사용하지 않는다**.
 * - `symbol` 태그는 거래쌍(BTC_KRW 등) 과 같이 카디널리티가 제한된 값만 허용.
 * - `from_version` / `to_version` 태그는 KEK 라벨이 아닌 INT 값 — 카디널리티 제한 (회전 횟수 ≤ 일 단위).
 * - `exchange`, `outcome`, `source`, `reason` 태그 또한 enum 또는 상수 집합으로만 발행한다.
 * - `channel`, `priority`, `reason` (notification) 태그도 enum / 상수 집합만 사용 (telegram/email, CRITICAL/RISK/INFO 등).
 */
@Component
class QuantMetrics(
    private val registry: MeterRegistry,
) {

    /** 백테스트 1회 성공 시 증가. */
    val backtestRunSuccess: Counter = Counter.builder(METRIC_BACKTEST_RUN_TOTAL)
        .description("Total successful backtest runs")
        .tag("status", "success")
        .register(registry)

    /** 백테스트 1회 실패 시 증가. */
    val backtestRunFailed: Counter = Counter.builder(METRIC_BACKTEST_RUN_TOTAL)
        .description("Total failed backtest runs")
        .tag("status", "failed")
        .register(registry)

    /** 백테스트 실행 시간 전반. [recordBacktestDuration] 을 통해 기록. */
    val backtestDuration: Timer = Timer.builder(METRIC_BACKTEST_RUN_DURATION)
        .description("Backtest run duration in seconds")
        .publishPercentiles(0.5, 0.95, 0.99)
        .register(registry)

    /** 전략 평가 루프(per-bar) 지연. Phase 1 은 backtest 모드만 사용. */
    val strategyEvaluationLatencyBacktest: Timer = Timer.builder(METRIC_STRATEGY_EVALUATION_LATENCY)
        .description("Strategy evaluation latency per bar")
        .tag("mode", "backtest")
        .publishPercentiles(0.5, 0.95, 0.99)
        .register(registry)

    // symbol 별 Counter 캐시 — 재등록 비용 회피 + 카디널리티 통제
    private val ingestCounters = ConcurrentHashMap<String, Counter>()

    /**
     * 빗썸 히스토리 수집에서 실제로 적재된 row 수를 symbol 단위로 누적.
     *
     * @param symbol 예: `BTC_KRW` (Phase 1 은 2종만 노출되므로 카디널리티 안전).
     * @param rows `IngestResult.inserted` 값. 0 이면 무시.
     */
    fun ingestRowsIncrement(symbol: String, rows: Long) {
        if (rows <= 0L) return
        val counter = ingestCounters.computeIfAbsent(symbol) {
            Counter.builder(METRIC_INGEST_BITHUMB_ROWS_TOTAL)
                .description("Total rows ingested from Bithumb candle API")
                .tag("symbol", symbol)
                .register(registry)
        }
        counter.increment(rows.toDouble())
    }

    /** [backtestDuration] 에 nanos 를 기록. */
    fun recordBacktestDuration(nanos: Long) {
        backtestDuration.record(nanos, TimeUnit.NANOSECONDS)
    }

    // --- TG-P2-03: KEK 캐시 메트릭 ---

    private val kekCacheHits: Counter = Counter.builder(METRIC_KEK_CACHE_HITS_TOTAL)
        .description("Total DEK cache hits (no KMS call needed)")
        .register(registry)

    private val kekCacheMisses: Counter = Counter.builder(METRIC_KEK_CACHE_MISSES_TOTAL)
        .description("Total DEK cache misses (KMS unwrap invoked)")
        .register(registry)

    private val kekCacheStale: Counter = Counter.builder(METRIC_KEK_CACHE_STALE_TOTAL)
        .description("Total stale-on-error DEK cache hits (KMS failure fallback)")
        .register(registry)

    /** DEK 캐시 hit 1건 카운트. */
    fun kekCacheHit() = kekCacheHits.increment()

    /** DEK 캐시 miss 1건 카운트 (KMS unwrap 호출 직후). */
    fun kekCacheMiss() = kekCacheMisses.increment()

    /** KMS 장애 시 만료된 캐시 entry 를 stale 로 반환한 횟수. */
    fun kekCacheStale() = kekCacheStale.increment()

    // --- TG-P2-04: KEK rotation lazy re-encryption 메트릭 ---

    /**
     * (from_version, to_version, table) 조합별 카운터 캐시.
     * 회전 횟수 / 테이블 수 모두 제한되므로 카디널리티 안전.
     */
    private val rotationCounters = ConcurrentHashMap<Triple<Int, Int, String>, Counter>()

    /**
     * Lazy re-encryption 잡이 row 1건을 새 KEK 로 재암호화 성공한 카운트.
     *
     * @param fromVersion 직전 KEK INT 버전 (entity 의 stale `kek_version`).
     * @param toVersion   현재 활성 KEK INT 버전.
     * @param table       대상 테이블 이름 (`exchange_credential` / `notification_target`).
     */
    fun kekRotationReencrypted(fromVersion: Int, toVersion: Int, table: String) {
        val counter = rotationCounters.computeIfAbsent(Triple(fromVersion, toVersion, table)) {
            Counter.builder(METRIC_KEK_ROTATION_LAZY_REENCRYPT_TOTAL)
                .description("Total rows successfully re-encrypted by lazy reencryption job")
                .tag("from_version", fromVersion.toString())
                .tag("to_version", toVersion.toString())
                .tag("table", table)
                .register(registry)
        }
        counter.increment()
    }

    // --- TG-P2-05: audit chain 메트릭 ---

    private val auditLogAppendedCounter: Counter = Counter
        .builder(METRIC_AUDIT_LOG_APPENDED_TOTAL)
        .description("Total audit_log rows successfully appended (writer user, ClickHouse quant_audit)")
        .register(registry)

    private val auditHashChainInvalidCounter: Counter = Counter
        .builder(METRIC_AUDIT_HASH_CHAIN_INVALID_TOTAL)
        .description("Total invalid hash-chain rows detected by AuditChainVerifier")
        .register(registry)

    /** audit_log row 1건이 ClickHouse 에 INSERT 성공했을 때 호출. */
    fun auditLogAppended() = auditLogAppendedCounter.increment()

    /** AuditChainVerifier 가 검증 사이클에서 invalid 로 탐지한 row 수만큼 누적. */
    fun auditHashChainInvalid(count: Int) {
        if (count <= 0) return
        auditHashChainInvalidCounter.increment(count.toDouble())
    }

    // --- TG-P2-06 / TG-P2-07: 시세 hot path 메트릭 ---

    /**
     * (exchange, symbol, source) 조합별 Counter 캐시.
     * symbol 카디널리티는 Phase 2 default 2종(BTC_KRW/ETH_KRW), source = enum 3종(WS/REST/BACKTEST) 으로 제한.
     */
    private val tickReceivedCounters = ConcurrentHashMap<Triple<String, String, String>, Counter>()

    /**
     * 시세 1건 수신/정규화 성공 시 증가.
     *
     * @param exchange `bithumb` / `upbit` (lowercase 권장)
     * @param symbol 거래쌍 (예: `BTC_KRW`)
     * @param source [com.kgd.quant.application.port.marketdata.TickSource] enum name (`WS` / `REST`)
     */
    fun marketTickReceived(exchange: String, symbol: String, source: String) {
        val counter = tickReceivedCounters.computeIfAbsent(Triple(exchange, symbol, source)) {
            Counter.builder(METRIC_MARKET_TICK_RECEIVED_TOTAL)
                .description("Total ticks received and normalized into MarketDataHub")
                .tag("exchange", exchange)
                .tag("symbol", symbol)
                .tag("source", source)
                .register(registry)
        }
        counter.increment()
    }

    /** (exchange, outcome) 조합별 Counter 캐시. outcome ∈ {success, fail}. */
    private val wsReconnectCounters = ConcurrentHashMap<Pair<String, String>, Counter>()

    /**
     * WebSocket 재연결 시도 1건 카운트.
     *
     * @param exchange 거래소 이름 (`bithumb`)
     * @param outcome `success` 또는 `fail`
     */
    fun wsReconnectAttempt(exchange: String, outcome: String) {
        val counter = wsReconnectCounters.computeIfAbsent(exchange to outcome) {
            Counter.builder(METRIC_WS_RECONNECT_ATTEMPTS_TOTAL)
                .description("Total WebSocket reconnect attempts grouped by outcome")
                .tag("exchange", exchange)
                .tag("outcome", outcome)
                .register(registry)
        }
        counter.increment()
    }

    /**
     * WebSocket 연결 상태 gauge 백업 atomic. Gauge 등록은 [registerWsConnectionState] 에서 lazy 수행.
     * 0 = disconnected / 1 = fallback / 2 = connected.
     */
    private val wsConnectionStates = ConcurrentHashMap<String, AtomicInteger>()

    /**
     * 거래소 단위 WebSocket 연결 상태 gauge 갱신.
     * 첫 호출 시 gauge 가 lazy 등록되며, 이후 호출은 atomic value 만 갱신한다.
     */
    fun setWsConnectionState(exchange: String, state: Int) {
        val ref = wsConnectionStates.computeIfAbsent(exchange) {
            val holder = AtomicInteger(state)
            Gauge.builder(METRIC_WS_CONNECTION_STATE, holder) { it.get().toDouble() }
                .description("WebSocket connection state (0=disconnected,1=fallback,2=connected)")
                .tag("exchange", exchange)
                .register(registry)
            holder
        }
        ref.set(state)
    }

    /** (reason) 별 Counter 캐시. reason ∈ {buffer_overflow}. */
    private val marketHubDroppedCounters = ConcurrentHashMap<String, Counter>()

    /** SharedFlow tryEmit 실패 (느린 소비자로 인한 buffer overflow) 카운트. */
    fun marketHubDropped(reason: String) {
        val counter = marketHubDroppedCounters.computeIfAbsent(reason) {
            Counter.builder(METRIC_MARKET_HUB_DROPPED_TOTAL)
                .description("Total ticks dropped from MarketDataHub SharedFlow buffer")
                .tag("reason", reason)
                .register(registry)
        }
        counter.increment()
    }

    private val marketHubKafkaPublishFailureCounter: Counter = Counter
        .builder(METRIC_MARKET_HUB_KAFKA_PUBLISH_FAILURE_TOTAL)
        .description("Total Kafka publish failures from MarketTickKafkaCollector (does not block hot path)")
        .register(registry)

    /** Kafka fan-out collector 발행 실패 (hot path 영향 없음) 카운트. */
    fun marketHubKafkaPublishFailure() = marketHubKafkaPublishFailureCounter.increment()

    // --- TG-P2-10: Telegram notification 메트릭 ---

    /**
     * (channel, priority) 조합별 Timer 캐시.
     * channel: `telegram` (Phase 2 단일), priority: enum 3종 (CRITICAL/RISK/INFO) — 카디널리티 ≤ 6.
     */
    private val notificationLatencyTimers =
        ConcurrentHashMap<Pair<String, String>, Timer>()

    /**
     * 알림 1건 발송 성공 후 latency(ms) 를 [Timer] 에 기록한다.
     *
     * @param channel  발송 채널 (`telegram`, 향후 `email` 등). lowercase 권장.
     * @param priority [NotificationPriority] enum name (`CRITICAL` / `RISK` / `INFO`).
     * @param latencyMs WebClient 호출 ~ 응답까지 millis. 음수 입력은 무시.
     */
    fun notificationSendLatency(channel: String, priority: String, latencyMs: Long) {
        if (latencyMs < 0L) return
        val timer = notificationLatencyTimers.computeIfAbsent(channel to priority) {
            Timer.builder(METRIC_NOTIFICATION_SEND_LATENCY)
                .description("Notification send latency by channel and priority")
                .tag("channel", channel)
                .tag("priority", priority)
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry)
        }
        timer.record(latencyMs, TimeUnit.MILLISECONDS)
    }

    /**
     * (channel, reason) 조합별 Counter 캐시. reason 은 enum 또는 상수 집합으로 제한:
     * `not_configured`, `client_error_4xx`, `max_retries_exceeded`, `client_error_<code>` 등.
     */
    private val notificationFailureCounters =
        ConcurrentHashMap<Pair<String, String>, Counter>()

    /**
     * 알림 발송 실패 1건 누적. 4xx / 5xx 최종 실패 / 토큰 미설정 등 모든 실패 사유 통합.
     *
     * @param channel 발송 채널
     * @param reason  실패 사유 라벨 — 카디널리티 통제를 위해 상수/enum 으로만 발행.
     */
    fun notificationSendFailure(channel: String, reason: String) {
        val counter = notificationFailureCounters.computeIfAbsent(channel to reason) {
            Counter.builder(METRIC_NOTIFICATION_SEND_FAILURE_TOTAL)
                .description("Total notification send failures by channel and reason")
                .tag("channel", channel)
                .tag("reason", reason)
                .register(registry)
        }
        counter.increment()
    }

    /** priority 별 queue depth gauge 가 등록된 큐 reference 캐시. priority 당 최대 1회 등록. */
    private val notificationQueueDepthRegistered =
        ConcurrentHashMap<NotificationPriority, NotificationPriorityQueue>()

    /**
     * Notification 큐의 [size] 를 priority 별 gauge 로 노출.
     *
     * Spring 컨텍스트 시작 시 [com.kgd.quant.infrastructure.notification.NotificationDispatcher]
     * 또는 별도 init 빈에서 1회 호출하면 priority 마다 gauge 가 등록된다.
     *
     * 두 번째 이후 호출은 no-op (queue reference 가 동일해도 등록을 반복하지 않음).
     */
    fun registerNotificationQueueDepth(queue: NotificationPriorityQueue) {
        for (priority in NotificationPriority.values()) {
            notificationQueueDepthRegistered.computeIfAbsent(priority) {
                Gauge.builder(METRIC_NOTIFICATION_QUEUE_DEPTH, queue) { it.size(priority).toDouble() }
                    .description("Current depth of notification priority queue")
                    .tag("priority", priority.name)
                    .register(registry)
                queue
            }
        }
    }

    companion object {
        const val METRIC_BACKTEST_RUN_TOTAL = "quant_backtest_run_total"
        const val METRIC_BACKTEST_RUN_DURATION = "quant_backtest_run_duration_seconds"
        const val METRIC_STRATEGY_EVALUATION_LATENCY = "quant_strategy_evaluation_latency_seconds"
        const val METRIC_INGEST_BITHUMB_ROWS_TOTAL = "quant_ingest_bithumb_rows_total"
        const val METRIC_OUTBOX_PENDING_ROWS = "quant_outbox_pending_rows"
        const val METRIC_KEK_CACHE_HITS_TOTAL = "quant_kek_cache_hits_total"
        const val METRIC_KEK_CACHE_MISSES_TOTAL = "quant_kek_cache_misses_total"
        const val METRIC_KEK_CACHE_STALE_TOTAL = "quant_kek_cache_stale_total"
        const val METRIC_KEK_ROTATION_LAZY_REENCRYPT_TOTAL = "quant_kek_rotation_lazy_reencrypt_total"
        const val METRIC_AUDIT_LOG_APPENDED_TOTAL = "quant_audit_log_appended_total"
        const val METRIC_AUDIT_HASH_CHAIN_INVALID_TOTAL = "quant_audit_hash_chain_invalid_total"
        const val METRIC_MARKET_TICK_RECEIVED_TOTAL = "quant_market_tick_received_total"
        const val METRIC_WS_RECONNECT_ATTEMPTS_TOTAL = "quant_ws_reconnect_attempts_total"
        const val METRIC_WS_CONNECTION_STATE = "quant_ws_connection_state"
        const val METRIC_MARKET_HUB_DROPPED_TOTAL = "quant_market_hub_dropped_total"
        const val METRIC_MARKET_HUB_KAFKA_PUBLISH_FAILURE_TOTAL = "quant_market_hub_kafka_publish_failure_total"
        const val METRIC_NOTIFICATION_SEND_LATENCY = "quant_notification_send_latency_seconds"
        const val METRIC_NOTIFICATION_SEND_FAILURE_TOTAL = "quant_notification_send_failure_total"
        const val METRIC_NOTIFICATION_QUEUE_DEPTH = "quant_notification_queue_depth"
    }
}
