package com.kgd.quant.infrastructure.metrics

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Tags
import io.micrometer.core.instrument.Timer
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * QuantPlatformMetrics — 통합 플랫폼 Phase 1 후반 Prometheus 메트릭 (ADR-0033 §9).
 *
 * - quant_signal_eval_total{signal_type, triggered}    : 시그널 평가 카운터
 * - quant_indicator_calc_latency_seconds{type}         : 지표 계산 지연 (히스토그램)
 *
 * ingest sidecar 메트릭(quant_ingest_*) 은 sidecar 프로세스 자체에서 노출하므로 본 클래스는
 * 메인 서비스 메트릭만 담당.
 */
@Component
class QuantPlatformMetrics(private val registry: MeterRegistry) {

    fun signalEvaluated(signalType: String, triggered: Boolean) {
        Counter.builder("quant_signal_eval_total")
            .description("시그널 평가 횟수 (triggered 여부 별)")
            .tags(
                Tags.of(
                    "signal_type", signalType,
                    "triggered", triggered.toString(),
                )
            )
            .register(registry)
            .increment()
    }

    fun recordIndicatorLatency(type: String, duration: Duration) {
        Timer.builder("quant_indicator_calc_latency_seconds")
            .description("기술적 지표 계산 지연")
            .tag("type", type)
            .publishPercentileHistogram()
            .register(registry)
            .record(duration)
    }
}
