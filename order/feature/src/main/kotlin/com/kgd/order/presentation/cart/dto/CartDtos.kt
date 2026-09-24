package com.kgd.order.presentation.cart.dto

import com.kgd.order.application.cart.usecase.CartView
import com.kgd.order.domain.cart.model.CartItem
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min

data class PutCartItemRequest(
    @field:Min(value = 1, message = "수량은 1 이상이어야 합니다")
    @field:Max(value = CartItem.MAX_QUANTITY.toLong(), message = "수량이 너무 많습니다")
    val quantity: Int,
)

data class CartResponse(val items: List<CartLineResponse>) {
    companion object {
        fun from(view: CartView) = CartResponse(
            view.items.map { CartLineResponse(it.productId, it.quantity, it.productName, it.price, it.sellerId, it.onSale) },
        )
    }
}

data class CartLineResponse(
    val productId: Long,
    val quantity: Int,
    val productName: String?,
    val price: Long?,
    val sellerId: Long?,
    val onSale: Boolean,
)
