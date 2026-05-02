package com.kgd.inventory.infrastructure.metrics

import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * ADR-0032 Phase 3 / PR-4 — inventory 측 cancellation/expiry 가시성 메트릭.
 *
 * Exposed metrics:
 * - `inventory_reservation_expired_total` (counter) — TTL fallback 으로 만료된 reservation 수.
 *   ADR-0032 invariant: 정상 흐름에서 0 이어야 한다 (Outbox + cancellation consumer 가 1-2초 내 release).
 *   발화 시 `order.order.cancelled` 흐름 장애 또는 Outbox publisher 지연 의심.
 *   라벨: `warehouse_id` — warehouse 별 분기.
 * - `order_cancellation_to_release_latency_seconds` (timer/histogram) — `order.order.cancelled` event
 *   생성 시점(`eventTime`, Order 측 outbox.save 시각) → inventory release 완료 시점 사이 latency.
 *   p99 SLA: 5s (Outbox polling 1s + Kafka + consumer 처리). 초과 시 Phase 3 알람 발화.
 *   라벨: `reason` — cancellation 사유 (PAYMENT_FAILED / USER_CANCELLED / TIMEOUT / FRAUD / UNKNOWN).
 */
@Component
class InventoryMetrics(
    private val meterRegistry: MeterRegistry,
) {

    fun incrementReservationExpired(warehouseId: Long) {
        Counter.builder(METRIC_RESERVATION_EXPIRED_TOTAL)
            .description("Reservations released via 30-min TTL fallback (should be 0 in normal flow)")
            .tag("warehouse_id", warehouseId.toString())
            .register(meterRegistry)
            .increment()
    }

    fun recordOrderCancellationLatency(reason: String, latency: Duration) {
        // Negative latency (clock skew between order/inventory pods) — 통계 오염 방지를 위해 0 으로 클램프.
        val safe = if (latency.isNegative) Duration.ZERO else latency
        Timer.builder(METRIC_ORDER_CANCELLATION_TO_RELEASE_LATENCY)
            .description("Latency from order.order.cancelled event publication to inventory release completion")
            .tag("reason", reason.ifBlank { "UNKNOWN" })
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(meterRegistry)
            .record(safe)
    }

    companion object {
        const val METRIC_RESERVATION_EXPIRED_TOTAL = "inventory_reservation_expired_total"
        const val METRIC_ORDER_CANCELLATION_TO_RELEASE_LATENCY = "order_cancellation_to_release_latency_seconds"
    }
}
