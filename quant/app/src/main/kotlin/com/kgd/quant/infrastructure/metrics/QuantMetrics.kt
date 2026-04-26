package com.kgd.quant.infrastructure.metrics

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

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
 * Gauge `quant_outbox_pending_rows` 는 라이프사이클이 다르므로 [OutboxPendingMetric] 참조.
 *
 * ## 사용 규칙 (ADR-0021)
 * - API key / Bot token / 평문 credential 을 **태그 값으로 절대 사용하지 않는다**.
 * - `symbol` 태그는 거래쌍(BTC_KRW 등) 과 같이 카디널리티가 제한된 값만 허용.
 * - `from_version` / `to_version` 태그는 KEK 라벨이 아닌 INT 값 — 카디널리티 제한 (회전 횟수 ≤ 일 단위).
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
        backtestDuration.record(nanos, java.util.concurrent.TimeUnit.NANOSECONDS)
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
    }
}
