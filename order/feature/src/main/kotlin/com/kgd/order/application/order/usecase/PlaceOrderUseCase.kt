package com.kgd.order.application.order.usecase

import java.security.MessageDigest

/**
 * 주문 접수 — 주문서 하나로 주문을 만들고 사가를 시작한다(결과는 비동기, 상태는 조회로 본다).
 * `Idempotency-Key` 가 같으면 처리 중에는 409, 완료 뒤에는 처음 응답을 그대로 돌려준다.
 */
interface PlaceOrderUseCase {
    fun place(command: Command): OrderAccepted

    data class Command(val userId: String, val idempotencyKey: String, val orderSheetId: Long) {
        /**
         * 요청 본문의 지문(SHA-256 hex) — 같은 키에 다른 본문이 왔는지 대조한다. 원문 바이트가 아니라 해석한 값으로 만든다
         * (공백·필드 순서가 달라도 같은 요청은 같은 지문). 본문 필드가 늘면 여기에 함께 넣는다.
         */
        val requestHash: String
            get() = MessageDigest.getInstance("SHA-256")
                .digest("orderSheetId=$orderSheetId".toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
    }
}

/** 202 응답 본문 — 완료된 멱등 키가 이 값을 그대로 저장해 다시 돌려준다 */
data class OrderAccepted(val orderId: Long, val status: String, val sagaStep: String)
