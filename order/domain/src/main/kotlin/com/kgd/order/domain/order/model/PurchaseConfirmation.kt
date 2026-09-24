package com.kgd.order.domain.order.model

import com.kgd.order.domain.sheet.model.ShippingLine

/** 구매 확정된 라인 하나 — 그 판매자의 마지막 ACTIVE 라인이었으면 판매자 배송비 라인이 함께 실린다 */
data class PurchaseConfirmation(val line: OrderItem, val shipping: ShippingLine?)
