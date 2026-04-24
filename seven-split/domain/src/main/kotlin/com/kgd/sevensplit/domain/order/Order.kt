package com.kgd.sevensplit.domain.order

import com.kgd.sevensplit.domain.common.OrderId
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.SlotId

/**
 * Order Entity — 외부 거래소에 접수된 주문 하나를 표현.
 *
 * - `type: SpotOrderType` 으로 margin/future 주문이 컴파일 시점에 차단됨 (INV-03).
 * - 상태 전이는 메서드를 통해서만 가능.
 */
class Order internal constructor(
    val orderId: OrderId,
    val slotId: SlotId,
    val side: OrderSide,
    val type: SpotOrderType,
    val quantity: Quantity,
    val price: Price?,
    status: OrderStatus,
    exchangeOrderId: String?,
    filledQuantity: Quantity
) {
    var status: OrderStatus = status
        private set

    var exchangeOrderId: String? = exchangeOrderId
        private set

    var filledQuantity: Quantity = filledQuantity
        private set

    init {
        when (type) {
            is SpotOrderType.Market ->
                require(price == null) { "Market order must not carry price" }
            is SpotOrderType.Limit ->
                require(price != null && price == type.price) {
                    "Limit order must carry a price matching type.price"
                }
        }
    }

    /** 거래소가 주문을 접수했을 때. */
    fun markSubmitted(exchangeOrderId: String) {
        status.ensureTransition(OrderStatus.SUBMITTED)
        this.exchangeOrderId = exchangeOrderId
        this.status = OrderStatus.SUBMITTED
    }

    /** 부분체결. 누적 체결량이 quantity 에 도달하면 FILLED. */
    fun applyExecution(execution: Execution) {
        val newFilled = filledQuantity + execution.quantity
        this.filledQuantity = newFilled
        if (newFilled >= quantity) {
            status.ensureTransition(OrderStatus.FILLED)
            this.status = OrderStatus.FILLED
        } else {
            status.ensureTransition(OrderStatus.PARTIALLY_FILLED)
            this.status = OrderStatus.PARTIALLY_FILLED
        }
    }

    fun markRejected() {
        status.ensureTransition(OrderStatus.REJECTED)
        this.status = OrderStatus.REJECTED
    }

    fun markCancelled() {
        status.ensureTransition(OrderStatus.CANCELLED)
        this.status = OrderStatus.CANCELLED
    }

    companion object {
        fun create(
            orderId: OrderId,
            slotId: SlotId,
            side: OrderSide,
            type: SpotOrderType,
            quantity: Quantity,
            price: Price?
        ): Order = Order(
            orderId = orderId,
            slotId = slotId,
            side = side,
            type = type,
            quantity = quantity,
            price = price,
            status = OrderStatus.ACCEPTED,
            exchangeOrderId = null,
            filledQuantity = Quantity.ZERO
        )

        fun reconstruct(
            orderId: OrderId,
            slotId: SlotId,
            side: OrderSide,
            type: SpotOrderType,
            quantity: Quantity,
            price: Price?,
            status: OrderStatus,
            exchangeOrderId: String?,
            filledQuantity: Quantity
        ): Order = Order(
            orderId = orderId,
            slotId = slotId,
            side = side,
            type = type,
            quantity = quantity,
            price = price,
            status = status,
            exchangeOrderId = exchangeOrderId,
            filledQuantity = filledQuantity
        )
    }
}
