package com.kgd.quant.infrastructure.metrics

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * QuantPhase3Metrics — Phase 3 실매매 전용 Micrometer facade (ADR-0037 / TG-P3-40).
 *
 * 메트릭 7종:
 * - `quant_live_orders_total{exchange,status}` — 거래소별 주문 카운터
 * - `quant_live_order_latency_seconds{exchange}` — 주문 round-trip 타이머
 * - `quant_kill_switch_state{scope,target}` — gauge (1=ON, 0=OFF) — KillSwitchService 가 갱신
 * - `quant_risk_limit_breach_total{tenant,type}` — 한도 초과 카운터
 * - `quant_reconcile_drift_total{exchange,drift_type}` — drift 카운터
 * - `quant_audit_chain_verify_total{result}` — 일일 verify pass/fail 카운터
 * - `quant_2fa_verify_total{result}` — 2FA 검증 success/failure 카운터
 *
 * 카디널리티 안전: tag 모두 enum / 상수 집합. tenant 태그는 카디널리티 폭발 위험 — 본 facade 는
 * tenant 태그 미사용 (전역 합산만). per-tenant 모니터링은 audit_event / risk_limit DB 직접 조회.
 */
@Component
class QuantPhase3Metrics(
    private val registry: MeterRegistry,
) {

    private val orderCounters = ConcurrentHashMap<Pair<String, String>, Counter>()
    private val orderLatencyTimers = ConcurrentHashMap<String, Timer>()
    private val riskBreachCounters = ConcurrentHashMap<String, Counter>()
    private val reconcileDriftCounters = ConcurrentHashMap<Pair<String, String>, Counter>()
    private val twoFaCounters = ConcurrentHashMap<String, Counter>()
    private val auditVerifyCounters = ConcurrentHashMap<String, Counter>()

    fun liveOrderRecorded(exchange: String, status: String) {
        orderCounters.computeIfAbsent(exchange to status) {
            Counter.builder(METRIC_LIVE_ORDERS_TOTAL)
                .description("Live orders by exchange and status (placed/filled/cancelled/rejected)")
                .tag("exchange", exchange)
                .tag("status", status)
                .register(registry)
        }.increment()
    }

    fun liveOrderLatency(exchange: String, latencyMs: Long) {
        if (latencyMs < 0L) return
        val timer = orderLatencyTimers.computeIfAbsent(exchange) {
            Timer.builder(METRIC_LIVE_ORDER_LATENCY)
                .description("Live order round-trip latency by exchange")
                .tag("exchange", exchange)
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry)
        }
        timer.record(latencyMs, TimeUnit.MILLISECONDS)
    }

    /**
     * @param type [com.kgd.quant.domain.live.SuspendReason] enum name 권장 (DAILY_LOSS_LIMIT 등).
     */
    fun riskLimitBreach(type: String) {
        riskBreachCounters.computeIfAbsent(type) {
            Counter.builder(METRIC_RISK_LIMIT_BREACH_TOTAL)
                .description("Risk limit breach count by type")
                .tag("type", type)
                .register(registry)
        }.increment()
    }

    fun reconcileDrift(exchange: String, driftType: String) {
        reconcileDriftCounters.computeIfAbsent(exchange to driftType) {
            Counter.builder(METRIC_RECONCILE_DRIFT_TOTAL)
                .description("Reconcile drift count by exchange and drift type")
                .tag("exchange", exchange)
                .tag("drift_type", driftType)
                .register(registry)
        }.increment()
    }

    fun twoFaVerify(result: String) {
        twoFaCounters.computeIfAbsent(result) {
            Counter.builder(METRIC_TWO_FA_VERIFY_TOTAL)
                .description("2FA verification by result (success / failure)")
                .tag("result", result)
                .register(registry)
        }.increment()
    }

    fun auditVerify(result: String) {
        auditVerifyCounters.computeIfAbsent(result) {
            Counter.builder(METRIC_AUDIT_CHAIN_VERIFY_TOTAL)
                .description("Daily audit chain verify by result (ok / fail)")
                .tag("result", result)
                .register(registry)
        }.increment()
    }

    companion object {
        const val METRIC_LIVE_ORDERS_TOTAL = "quant_live_orders_total"
        const val METRIC_LIVE_ORDER_LATENCY = "quant_live_order_latency_seconds"
        const val METRIC_RISK_LIMIT_BREACH_TOTAL = "quant_risk_limit_breach_total"
        const val METRIC_RECONCILE_DRIFT_TOTAL = "quant_reconcile_drift_total"
        const val METRIC_AUDIT_CHAIN_VERIFY_TOTAL = "quant_audit_chain_verify_total"
        const val METRIC_TWO_FA_VERIFY_TOTAL = "quant_2fa_verify_total"
        // kill_switch_state 는 KillSwitchService 가 직접 Gauge 등록 (변동성 패턴)
    }
}
