package com.kgd.analytics.infrastructure.streaming

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventType

data class ProductMetrics(
    var impressions: Long = 0,
    var clicks: Long = 0,
    var orders: Long = 0,
    var gmv: Double = 0.0
) {
    fun add(event: AnalyticsEvent): ProductMetrics {
        when (event.eventType) {
            EventType.PRODUCT_VIEW -> impressions++
            EventType.PRODUCT_CLICK -> clicks++
            EventType.ORDER_COMPLETE -> {
                orders++
                gmv += extractAmount(event)
            }
            else -> {}
        }
        return this
    }

    /**
     * ORDER_COMPLETE 이벤트의 payload 에서 주문 금액을 추출. 키 후보를 순서대로 시도:
     * - `amount` / `totalPrice` / `gmv` (별칭) → 모두 number 일 때 사용
     * - 누락 시 0.0 (GMV 미발행 신호로 간주, 추후 publisher 업그레이드 필요)
     */
    private fun extractAmount(event: AnalyticsEvent): Double {
        val candidates = listOf("amount", "totalPrice", "gmv")
        for (key in candidates) {
            val raw = event.payload[key] ?: continue
            val value = when (raw) {
                is Number -> raw.toDouble()
                is String -> raw.toDoubleOrNull()
                else -> null
            }
            if (value != null && value >= 0.0) return value
        }
        return 0.0
    }
}
