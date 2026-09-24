package com.kgd.order.application.order.usecase

/**
 * 구매자 취소 — 피벗 전(CREATED, 재고·혜택 예약 단계)만 받는다. 보상을 시작하고 끝나면 CANCELLED.
 * 결제 결과 확인 중(PAYMENT_PENDING)과 결제 뒤는 409 — 결제 뒤 취소는 클레임으로 한다.
 */
interface CancelOrderUseCase {
    fun cancel(userId: String, orderId: Long): OrderDetail
}
