package com.kgd.quant.application.metrics.port

/** Phase 3 실매매 계측의 포트 (ADR-0037 / TG-P3-40). 태그 값은 enum·상수 집합만 */
interface QuantPhase3MetricsPort {
    fun liveOrderRecorded(exchange: String, status: String)
    fun liveOrderLatency(exchange: String, latencyMs: Long)
    fun riskLimitBreach(type: String)
    fun twoFaVerify(result: String)
}
