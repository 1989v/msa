package com.kgd.order.application.order.usecase

/**
 * 주문 접수 — 주문서 하나로 주문을 만들고 사가를 시작한다(결과는 비동기, 상태는 조회로 본다).
 * `Idempotency-Key` 가 같으면 처리 중에는 409, 완료 뒤에는 처음 응답을 그대로 돌려준다.
 */
interface PlaceOrderUseCase {
    fun place(command: Command): OrderAccepted

    data class Command(val userId: String, val idempotencyKey: String, val orderSheetId: Long)
}

/** 202 응답 본문 — 완료된 멱등 키가 이 값을 그대로 저장해 다시 돌려준다 */
data class OrderAccepted(val orderId: Long, val status: String, val sagaStep: String)
