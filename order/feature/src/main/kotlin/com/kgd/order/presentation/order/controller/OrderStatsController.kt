package com.kgd.order.presentation.order.controller

import com.kgd.common.response.ApiResponse
import com.kgd.order.application.order.usecase.GetOrderStatsUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal

/** OrderStatsController — admin dashboard 용 read-only 집계. */
@RestController
@RequestMapping("/api/orders/stats")
class OrderStatsController(
    private val getOrderStats: GetOrderStatsUseCase,
) {
    @GetMapping("/today")
    fun todayOrderCount(): ApiResponse<Long> = ApiResponse.success(getOrderStats.todayOrderCount())

    @GetMapping("/revenue/today")
    fun todayRevenue(): ApiResponse<BigDecimal> = ApiResponse.success(getOrderStats.todayRevenue())

    @GetMapping("/daily")
    fun dailyOrderStats(@RequestParam(defaultValue = "7") days: Int): ApiResponse<List<DailyOrderStat>> =
        ApiResponse.success(getOrderStats.dailyOrderCounts(days).map { DailyOrderStat(it.date, it.count) })

    @GetMapping("/by-category")
    fun revenueByCategory(): ApiResponse<List<CategoryRevenue>> {
        // 카테고리 정보는 product 서비스 소유. order 단독으로는 join 불가 (cross-service DB 금지).
        // Phase 2 이후: order.completed 이벤트에 카테고리 snapshot 포함 또는 BFF/aggregator 도입.
        return ApiResponse.success(emptyList())
    }
}

data class DailyOrderStat(val date: String, val count: Long)
data class CategoryRevenue(val category: String, val revenue: BigDecimal)
