package com.kgd.fulfillment.domain.fulfillment.model

/** 이행 한 건 안의 상품 한 줄. 클레임이 출고 전에 라인 단위로 취소한다 */
class FulfillmentLine private constructor(
    val id: Long?,
    val productId: Long,
    val quantity: Int,
    private var status: FulfillmentLineStatus,
) {
    companion object {
        fun create(productId: Long, quantity: Int): FulfillmentLine {
            require(quantity > 0) { "이행 라인 수량은 0보다 커야 합니다: productId=$productId, quantity=$quantity" }
            return FulfillmentLine(null, productId, quantity, FulfillmentLineStatus.ACTIVE)
        }

        fun restore(id: Long?, productId: Long, quantity: Int, status: FulfillmentLineStatus) =
            FulfillmentLine(id, productId, quantity, status)
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
