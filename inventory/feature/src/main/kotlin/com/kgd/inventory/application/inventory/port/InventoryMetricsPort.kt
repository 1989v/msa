package com.kgd.inventory.application.inventory.port

import java.time.Duration

/** 취소·만료 가시성 메트릭 (ADR-0032 Phase 3). 구현은 Micrometer — application 은 레지스트리를 모른다 */
interface InventoryMetricsPort {
    /** TTL fallback 으로 만료된 reservation — 정상 흐름이면 0 이어야 한다 */
    fun incrementReservationExpired(warehouseId: Long)
    fun recordOrderCancellationLatency(reason: String, latency: Duration)
}
