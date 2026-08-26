package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.usecase.GetOrderStatsUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate

/**
 * 어드민 대시보드 집계. 주문 생성 흐름과 트랜잭션 경계가 달라 [OrderService] 와 분리한다.
 *
 * 빈 결과 / 에러 시 admin FE 가 graceful degrade (catch → 0/[]) 하므로 여기선 0 으로 접는다.
 */
@Service
@Transactional("orderTransactionManager", readOnly = true)
class OrderStatsService(
    private val orderRepository: OrderRepositoryPort,
) : GetOrderStatsUseCase {

    override fun todayOrderCount(): Long =
        orderRepository.countCreatedAfter(LocalDate.now().atStartOfDay())

    override fun todayRevenue(): BigDecimal =
        orderRepository.sumRevenueCreatedAfter(LocalDate.now().atStartOfDay())

    override fun dailyOrderCounts(days: Int): List<GetOrderStatsUseCase.DailyStat> {
        val today = LocalDate.now()
        val from = today.minusDays(days.toLong() - 1).atStartOfDay()
        val byDate = orderRepository.countDailyCreatedAfter(from).associate { it.date to it.count }
        // 주문이 없는 날도 0 으로 채워 N 일 시계열을 보장한다
        return (0 until days).map { offset ->
            val date = today.minusDays(offset.toLong())
            GetOrderStatsUseCase.DailyStat(date = date.toString(), count = byDate[date] ?: 0)
        }.reversed()
    }
}
