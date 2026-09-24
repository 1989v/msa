package com.kgd.order.application.order.port

import com.kgd.order.domain.order.model.Order
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime

interface OrderRepositoryPort {
    /** 새 주문이면 라인·배송비와 함께 넣고, 있으면 상태·실패 사유·환불 누계·라인 상태를 옮긴다. 쌓인 상태 이력은 함께 남긴다 */
    fun save(order: Order): Order
    fun findById(id: Long): Order?
    fun findAllByUserId(userId: String): List<Order>

    /** 결제 대기(CREATED · PAYMENT_PENDING) 주문 수 */
    fun countAwaitingPayment(userId: String): Long

    /** 어드민 대시보드 집계 — [from] 이후 생성된 주문 수. */
    fun countCreatedAfter(from: LocalDateTime): Long

    /** 어드민 대시보드 집계 — [from] 이후 매출 합계. 주문이 없으면 0. */
    fun sumRevenueCreatedAfter(from: LocalDateTime): BigDecimal

    /** 어드민 대시보드 집계 — [from] 이후 일자별 주문 수. 주문이 없는 날은 행이 없다. */
    fun countDailyCreatedAfter(from: LocalDateTime): List<DailyOrderCount>
}

data class DailyOrderCount(val date: LocalDate, val count: Long)
