package com.kgd.order.application.saga.usecase

import com.kgd.order.domain.saga.model.ReservedLine

/**
 * 사가 코디네이터가 받는 답·이벤트 (키 = orderId). 같은 답이 다시 와도 사가 단계와 맞지 않으면 무시한다 —
 * 받는 쪽이 재발행 명령에 처음 답을 다시 내므로 이 대조가 멱등의 한 겹이다.
 */
interface HandleSagaEventUseCase {
    fun onInventory(answer: InventoryAnswer)
    fun onPromotion(answer: PromotionAnswer)
    fun onPayment(outcome: PaymentOutcome)
    fun onFulfillmentCreated(orderId: Long)
}

/** 기한 스케줄러 — 기한이 지난 사가마다 지금 단계 명령을 다시 내거나, 피벗 전 기한 초과면 보상, 한도 초과면 STUCK */
interface ProcessSagaDeadlineUseCase {
    fun dueOrderIds(limit: Int): List<Long>
    fun onDeadline(orderId: Long)
}

enum class InventoryAnswerType { RESERVED, FAILED, CONFIRMED, RELEASED, RESTOCKED, EXPIRED }

/** `inventory.reservation.*`. [command] 는 답을 부른 명령(RESERVE·CONFIRM·RELEASE·RESTOCK), 만료는 null */
data class InventoryAnswer(
    val orderId: Long,
    val type: InventoryAnswerType,
    val command: String?,
    val reason: String? = null,
    val lines: List<ReservedLine> = emptyList(),
)

enum class PromotionAnswerType { RESERVED, FAILED, CONFIRMED, CANCELLED, EXPIRED, RESTORED }

/** `promotion.hold.*`. [command] 는 RESERVE·CONFIRM·CANCEL·RESTORE·EXPIRE */
data class PromotionAnswer(val orderId: Long, val type: PromotionAnswerType, val command: String?, val reason: String? = null)

enum class PaymentOutcomeType { AUTHORIZED, FAILED, UNKNOWN, CAPTURED, VOIDED }

/** `payment.payment.*` */
data class PaymentOutcome(val orderId: Long, val type: PaymentOutcomeType, val reason: String? = null)

