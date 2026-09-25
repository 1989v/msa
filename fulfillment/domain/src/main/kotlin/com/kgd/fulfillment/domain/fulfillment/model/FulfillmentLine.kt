package com.kgd.fulfillment.domain.fulfillment.model

/**
 * 이행 한 건 안의 주문 라인 하나. 주문 라인 id([orderItemId])로 식별한다 — 같은 상품이 두 라인이어도 따로 취소된다.
 * 클레임이 출고 전에 라인 단위로 취소한다. [orderItemId] 가 null 인 행은 이 식별이 생기기 전에 만든 것이다.
 */
class FulfillmentLine private constructor(
    val id: Long?,
    val orderItemId: Long?,
    val productId: Long,
    val quantity: Int,
    private var status: FulfillmentLineStatus,
) {
    companion object {
        fun create(orderItemId: Long, productId: Long, quantity: Int): FulfillmentLine {
            require(quantity > 0) { "이행 라인 수량은 0보다 커야 합니다: orderItemId=$orderItemId, quantity=$quantity" }
            return FulfillmentLine(null, orderItemId, productId, quantity, FulfillmentLineStatus.ACTIVE)
        }

        fun restore(id: Long?, orderItemId: Long?, productId: Long, quantity: Int, status: FulfillmentLineStatus) =
            FulfillmentLine(id, orderItemId, productId, quantity, status)
    }

    internal fun cancel() {
        status = FulfillmentLineStatus.CANCELLED
    }

    fun getStatus(): FulfillmentLineStatus = status
}

enum class FulfillmentLineStatus { ACTIVE, CANCELLED }

/** 라인 취소 결과 — [Cancelled.lines] 는 이번에 취소한 라인(이미 취소돼 있던 것은 빠진다) */
sealed interface LineCancelResult {
    data class Cancelled(val lines: List<FulfillmentLine>, val wholeCancelled: Boolean) : LineCancelResult
    data class Rejected(val status: FulfillmentStatus) : LineCancelResult
}
