package com.kgd.order.application.order.usecase

import java.math.BigDecimal

/** 어드민 대시보드용 주문 집계 (read-only). */
interface GetOrderStatsUseCase {
    fun todayOrderCount(): Long
    fun todayRevenue(): BigDecimal

    /** 최근 [days] 일 시계열. 주문이 없는 날도 0 으로 채워 길이가 항상 [days] 다. */
    fun dailyOrderCounts(days: Int): List<DailyStat>

    data class DailyStat(val date: String, val count: Long)
}
