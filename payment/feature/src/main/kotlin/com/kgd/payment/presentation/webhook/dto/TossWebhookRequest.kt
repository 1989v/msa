package com.kgd.payment.presentation.webhook.dto

/**
 * 토스 `PAYMENT_STATUS_CHANGED` 웹훅 본문. 여기서 쓰는 것은 `data.orderId`(= 우리 orderNo) 하나다 —
 * 상태·금액 필드는 받기만 하고 판정에 쓰지 않는다(재조회 결과로 정한다).
 */
data class TossWebhookRequest(
    val eventType: String? = null,
    val createdAt: String? = null,
    val data: Data? = null,
) {
    data class Data(
        val paymentKey: String? = null,
        val orderId: String? = null,
        val status: String? = null,
        val totalAmount: Long? = null,
    )
}
