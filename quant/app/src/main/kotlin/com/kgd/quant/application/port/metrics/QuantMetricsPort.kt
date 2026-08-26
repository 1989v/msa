package com.kgd.quant.application.port.metrics

/**
 * application 이 남기는 계측의 포트. 구현은 Micrometer(`infrastructure/metrics/QuantMetrics`) —
 * 여기 있는 메서드만 application 이 부른다. 인프라 전용 계측(WS 재연결·KEK 캐시·outbox)은 포트에 없다.
 */
interface QuantMetricsPort {
    fun backtestRunSucceeded()
    fun backtestRunFailed()
    fun recordBacktestDuration(nanos: Long)
    /** SharedFlow tryEmit 실패 (느린 소비자로 인한 buffer overflow) */
    fun marketHubDropped(reason: String)
}
