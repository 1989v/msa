package com.kgd.analytics.infrastructure.streaming

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventType

data class KeywordMetrics(
    var searchCount: Long = 0,
    var totalClicks: Long = 0,
    var totalOrders: Long = 0
) {
    fun add(event: AnalyticsEvent): KeywordMetrics {
        when (event.eventType) {
            EventType.SEARCH_KEYWORD -> searchCount++
            EventType.PRODUCT_CLICK -> totalClicks++
            EventType.ORDER_COMPLETE -> totalOrders++
            else -> {}
        }
        return this
    }
}
