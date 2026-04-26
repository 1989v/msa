package com.kgd.sevensplit.infrastructure.metrics

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

/**
 * TG-14.2: Seven-split Phase 1 Micrometer facade.
 *
 * Phase 1 subset 메트릭:
 *  - `seven_split_backtest_run_total{status}` — 백테스트 성공/실패 누적 카운터
 *  - `seven_split_backtest_run_duration_seconds` — 백테스트 소요 시간 타이머 (p50/p95/p99 자동 히스토그램)
 *  - `seven_split_strategy_evaluation_latency_seconds{mode}` — 전략 평가 루프 지연 (backtest 모드 전용 Phase 1)
 *  - `seven_split_ingest_bithumb_rows_total{symbol}` — 빗썸 히스토리 수집 insert 건수
 *
 * Gauge `seven_split_outbox_pending_rows` 는 라이프사이클이 다르므로 [OutboxPendingMetric] 참조.
 *
 * ## 사용 규칙 (ADR-0021)
 * - API key / Bot token / 평문 credential 을 **태그 값으로 절대 사용하지 않는다**.
 * - `symbol` 태그는 거래쌍(BTC_KRW 등) 과 같이 카디널리티가 제한된 값만 허용.
 */
@Component
class SevenSplitMetrics(
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

    companion object {
        const val METRIC_BACKTEST_RUN_TOTAL = "seven_split_backtest_run_total"
        const val METRIC_BACKTEST_RUN_DURATION = "seven_split_backtest_run_duration_seconds"
        const val METRIC_STRATEGY_EVALUATION_LATENCY = "seven_split_strategy_evaluation_latency_seconds"
        const val METRIC_INGEST_BITHUMB_ROWS_TOTAL = "seven_split_ingest_bithumb_rows_total"
        const val METRIC_OUTBOX_PENDING_ROWS = "seven_split_outbox_pending_rows"
    }
}
