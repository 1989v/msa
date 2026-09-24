package com.kgd.order.presentation.order.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.order.application.order.usecase.GetOrderStatsUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.ModelAttribute
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal

/**
 * 어드민 대시보드용 read-only 집계. 게이트웨이가 ROLE_ADMIN 으로 막고, 서비스도 역할을 다시 본다 —
 * 매출은 게이트웨이 라우트 하나가 잘못 풀려도 새면 안 되는 값이다.
 */
@RestController
@RequestMapping("/api/v1/admin/orders/stats")
class OrderStatsController(
    private val getOrderStats: GetOrderStatsUseCase,
) {
    /** 모든 핸들러 앞에서 실행된다. 신원 헤더가 없으면 401, 어드민이 아니면 403. */
    @ModelAttribute
    fun requireAdmin(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ) {
        if (userId.isNullOrBlank()) throw BusinessException(ErrorCode.UNAUTHORIZED, "요청자 신원이 없습니다")
        if (roles.orEmpty().split(',').none { it.trim() == ROLE_ADMIN }) {
            throw BusinessException(ErrorCode.FORBIDDEN, "주문 통계는 어드민 전용입니다: userId=$userId")
        }
    }

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

private const val ROLE_ADMIN = "ROLE_ADMIN"

data class DailyOrderStat(val date: String, val count: Long)
data class CategoryRevenue(val category: String, val revenue: BigDecimal)
