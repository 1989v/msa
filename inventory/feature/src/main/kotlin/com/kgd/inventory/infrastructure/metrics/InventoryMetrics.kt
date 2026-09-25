package com.kgd.inventory.infrastructure.metrics

import com.kgd.inventory.application.inventory.port.InventoryMetricsPort
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component

/**
 * ADR-0032 Phase 3 / PR-4 — inventory 측 만료 가시성 메트릭.
 *
 * Exposed metrics:
 * - `inventory_reservation_expired_total` (counter) — TTL fallback 으로 만료된 reservation 수.
 *   ADR-0032 invariant: 정상 흐름에서 0 이어야 한다 (Outbox + cancellation consumer 가 1-2초 내 release).
 *   발화 시 `order.order.cancelled` 흐름 장애 또는 Outbox publisher 지연 의심.
 *   라벨: `warehouse_id` — warehouse 별 분기.
 */
@Component
class InventoryMetrics(
    private val meterRegistry: MeterRegistry,
) : InventoryMetricsPort {

    override fun incrementReservationExpired(warehouseId: Long) {
        Counter.builder(METRIC_RESERVATION_EXPIRED_TOTAL)
            .description("Reservations released via 30-min TTL fallback (should be 0 in normal flow)")
            .tag("warehouse_id", warehouseId.toString())
            .register(meterRegistry)
            .increment()
    }

    companion object {
        const val METRIC_RESERVATION_EXPIRED_TOTAL = "inventory_reservation_expired_total"
    }
}
