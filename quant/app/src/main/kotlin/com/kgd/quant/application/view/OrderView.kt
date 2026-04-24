package com.kgd.quant.application.view

import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.Quantity
import com.kgd.quant.domain.common.SlotId
import com.kgd.quant.domain.order.Order
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.domain.order.SpotOrderType

/**
 * OrderView — 백테스트 상세 응답의 주문 한 건.
 *
 * `type` 은 도메인 sealed class 를 그대로 노출한다 (Market / Limit).
 */
data class OrderView(
    val orderId: OrderId,
    val slotId: SlotId,
    val side: OrderSide,
    val type: SpotOrderType,
    val quantity: Quantity,
    val price: Price?,
    val status: OrderStatus,
    val filledQuantity: Quantity
) {
    companion object {
        fun from(order: Order): OrderView = OrderView(
            orderId = order.orderId,
            slotId = order.slotId,
            side = order.side,
            type = order.type,
            quantity = order.quantity,
            price = order.price,
            status = order.status,
            filledQuantity = order.filledQuantity
        )
    }
}
