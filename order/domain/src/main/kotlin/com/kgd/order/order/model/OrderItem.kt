package com.kgd.order.domain.order.model

data class OrderItem private constructor(
    val id: Long? = null,
    val productId: Long,
    val quantity: Int,
    val unitPrice: Money
) {
    val subtotal: Money get() = Money(unitPrice.amount * quantity.toBigDecimal())

    companion object {
        fun of(productId: Long, quantity: Int, unitPrice: Money): OrderItem {
            require(quantity > 0) { "수량은 0보다 커야 합니다" }
            return OrderItem(productId = productId, quantity = quantity, unitPrice = unitPrice)
        }

        fun restore(id: Long?, productId: Long, quantity: Int, unitPrice: Money): OrderItem =
            OrderItem(id = id, productId = productId, quantity = quantity, unitPrice = unitPrice)
    }
}
