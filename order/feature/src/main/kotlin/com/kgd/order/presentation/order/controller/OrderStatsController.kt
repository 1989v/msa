package com.kgd.order.presentation.order.controller

import com.kgd.common.response.ApiResponse
import com.kgd.order.infrastructure.persistence.order.repository.OrderJpaRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal
import java.time.LocalDate

/**
 * OrderStatsController — admin dashboard 용 read-only 집계.
 *
 * 트레이드오프: 도메인 로직 없이 단순 집계 read 만 수행하므로 port/adapter 추상화 생략하고
 * JpaRepository 직접 주입. Clean Architecture 의 application 레이어 분리는 비즈니스 로직이
 * 추가될 때 도입.
 *
 * 빈 결과 / 에러 시 admin FE 가 graceful degrade (catch → 0/[]) 하므로 본 컨트롤러는
 * 단순 nullable 처리만.
 */
@RestController
@RequestMapping("/api/orders/stats")
class OrderStatsController(
    private val orderJpaRepository: OrderJpaRepository,
) {
    @GetMapping("/today")
    fun todayOrderCount(): ApiResponse<Long> {
        val count = orderJpaRepository.countByCreatedAtAfter(LocalDate.now().atStartOfDay())
        return ApiResponse.success(count)
    }

    @GetMapping("/revenue/today")
    fun todayRevenue(): ApiResponse<BigDecimal> {
        val sum = orderJpaRepository.sumRevenueByCreatedAtAfter(LocalDate.now().atStartOfDay())
            ?: BigDecimal.ZERO
        return ApiResponse.success(sum)
    }

    @GetMapping("/daily")
    fun dailyOrderStats(@RequestParam(defaultValue = "7") days: Int): ApiResponse<List<DailyOrderStat>> {
        val from = LocalDate.now().minusDays(days.toLong() - 1).atStartOfDay()
        val rows = orderJpaRepository.aggregateDailyOrders(from)
        val byDate = rows.associate { (it[0] as java.sql.Date).toLocalDate() to (it[1] as Number).toLong() }
        // 날짜 빈 칸 0 으로 채워 N 일 시계열 보장
        val series = (0 until days).map { offset ->
            val date = LocalDate.now().minusDays(offset.toLong())
            DailyOrderStat(date = date.toString(), count = byDate[date] ?: 0)
        }.reversed()
        return ApiResponse.success(series)
    }

    @GetMapping("/by-category")
    fun revenueByCategory(): ApiResponse<List<CategoryRevenue>> {
        // 카테고리 정보는 product 서비스 소유. order 단독으로는 join 불가 (cross-service DB 금지).
        // Phase 2 이후: order.completed 이벤트에 카테고리 snapshot 포함 또는 BFF/aggregator 도입.
        return ApiResponse.success(emptyList())
    }
}

data class DailyOrderStat(val date: String, val count: Long)
data class CategoryRevenue(val category: String, val revenue: BigDecimal)
