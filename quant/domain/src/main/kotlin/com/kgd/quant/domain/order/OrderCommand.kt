package com.kgd.quant.domain.order

import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.Price
import com.kgd.quant.domain.common.Quantity

/**
 * 주문 실행 요청 DTO — Application → Exchange Adapter 간 전달.
 *
 * `type`이 [SpotOrderType.Market] 이면 price 는 null (또는 무시됨).
 * `type`이 [SpotOrderType.Limit] 이면 `type.price` 가 곧 지정가.
 */
data class OrderCommand(
    val orderId: OrderId,
    val side: OrderSide,
    val type: SpotOrderType,
    val quantity: Quantity,
    val price: Price?
)
