package com.kgd.analytics.infrastructure.streaming

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction

data class KeywordMetrics(
    var searchCount: Long = 0,
    var totalClicks: Long = 0,
    var totalOrders: Long = 0
) {
    fun add(event: AnalyticsEvent): KeywordMetrics {
        when {
            event.action == EventAction.SEARCH -> searchCount++
            // 클릭·주문은 상품 축만 센다 — 다른 대상이 섞이면 키워드 성과가 부풀려진다
            event.entityType != EntityType.PRODUCT -> Unit
            event.action == EventAction.CLICK -> totalClicks++
            event.action == EventAction.ORDER_COMPLETE -> totalOrders++
            else -> {}
        }
        return this
    }
}
