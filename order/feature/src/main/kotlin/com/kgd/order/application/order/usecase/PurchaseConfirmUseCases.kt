package com.kgd.order.application.order.usecase

/** 구매 확정 — 버튼(본인, 이행 중 주문의 ACTIVE 라인 전부) */
interface ConfirmPurchaseUseCase {
    fun confirm(userId: String, orderId: Long): List<Int>
}

/** 자동 구매 확정 — 배송 완료 후 N일 */
interface AutoConfirmPurchaseUseCase {
    fun candidateOrderIds(limit: Int): List<Long>
    fun autoConfirm(orderId: Long): List<Int>
}

/** 출고·배송 완료 표시 — `fulfillment.order.{shipped,delivered}` */
interface TrackDeliveryUseCase {
    fun onShipped(orderId: Long, productIds: Collection<Long>)
    fun onDelivered(orderId: Long, productIds: Collection<Long>)
}
