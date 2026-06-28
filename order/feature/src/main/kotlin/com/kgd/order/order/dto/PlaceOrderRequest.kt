package com.kgd.order.presentation.order.dto

import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import jakarta.validation.Valid
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Positive
import java.math.BigDecimal

data class PlaceOrderRequest(
    @field:NotEmpty(message = "주문 항목이 없습니다")
    @field:Valid
    val items: List<OrderItemRequest>
) {
    fun toCommand(userId: String) = PlaceOrderUseCase.Command(
        userId = userId,
        items = items.map { PlaceOrderUseCase.OrderItemCommand(it.productId, it.quantity, it.unitPrice) }
    )
}

data class OrderItemRequest(
    @field:Positive(message = "상품 ID는 0보다 커야 합니다")
    val productId: Long,
    @field:Min(value = 1, message = "수량은 1 이상이어야 합니다")
    val quantity: Int,
    @field:Positive(message = "단가는 0보다 커야 합니다")
    val unitPrice: BigDecimal
)
