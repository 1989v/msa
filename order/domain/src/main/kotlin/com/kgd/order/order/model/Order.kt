package com.kgd.order.domain.order.model

import java.time.LocalDateTime

class Order private constructor(
    val id: Long? = null,
    val userId: String,
    val items: List<OrderItem>,
    var status: OrderStatus,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    val totalAmount: Money
        get() = items.fold(Money(java.math.BigDecimal.ZERO)) { acc, item -> acc + item.subtotal }

    companion object {
        fun create(userId: String, items: List<OrderItem>): Order {
            require(items.isNotEmpty()) { "주문 항목이 없습니다" }
            require(userId.isNotBlank()) { "사용자 ID가 비어있을 수 없습니다" }
            return Order(userId = userId, items = items, status = OrderStatus.PENDING)
        }

        fun restore(
            id: Long?,
            userId: String,
            items: List<OrderItem>,
            status: OrderStatus,
            createdAt: LocalDateTime
        ): Order = Order(id = id, userId = userId, items = items, status = status, createdAt = createdAt)
    }

    fun complete() {
        check(status == OrderStatus.PENDING) { "PENDING 상태만 완료 처리할 수 있습니다" }
        status = OrderStatus.COMPLETED
    }

    fun cancel() {
        check(status == OrderStatus.PENDING) { "PENDING 상태만 취소할 수 있습니다" }
        status = OrderStatus.CANCELLED
    }
}
