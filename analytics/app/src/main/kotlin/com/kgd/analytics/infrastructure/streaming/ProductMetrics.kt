package com.kgd.analytics.infrastructure.streaming

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventType

data class ProductMetrics(
    var impressions: Long = 0,
    var clicks: Long = 0,
    var orders: Long = 0
) {
    fun add(event: AnalyticsEvent): ProductMetrics {
        when (event.eventType) {
            EventType.PRODUCT_VIEW -> impressions++
            EventType.PRODUCT_CLICK -> clicks++
            EventType.ORDER_COMPLETE -> orders++
            else -> {}
        }
        return this
    }
}
