package com.kgd.fulfillment.domain.fulfillment.model

import com.kgd.fulfillment.domain.fulfillment.event.FulfillmentEvent
import com.kgd.fulfillment.domain.fulfillment.exception.InvalidFulfillmentStateException
import java.time.LocalDateTime

class FulfillmentOrder private constructor(
    val id: Long? = null,
    val orderId: Long,
    val warehouseId: Long,
    private var status: FulfillmentStatus,
    val createdAt: LocalDateTime = LocalDateTime.now(),
    private val lines: List<FulfillmentLine> = emptyList(),
) {
    companion object {
        /** [lines] 는 (상품 id, 수량). 같은 상품은 한 줄로 합친다 — 라인 취소가 상품으로 줄을 찾는다 */
        fun create(orderId: Long, warehouseId: Long, lines: List<Pair<Long, Int>> = emptyList()): FulfillmentOrder {
            val merged = lines.groupBy({ it.first }, { it.second }).map { (productId, qty) -> FulfillmentLine.create(productId, qty.sum()) }
            return FulfillmentOrder(
                orderId = orderId,
                warehouseId = warehouseId,
                status = FulfillmentStatus.PENDING,
                lines = merged,
            )
        }

        fun restore(
            id: Long?,
            orderId: Long,
            warehouseId: Long,
            status: FulfillmentStatus,
            createdAt: LocalDateTime,
            lines: List<FulfillmentLine> = emptyList(),
        ): FulfillmentOrder = FulfillmentOrder(
            id = id,
            orderId = orderId,
            warehouseId = warehouseId,
            status = status,
            createdAt = createdAt,
            lines = lines,
        )
    }

    fun transition(to: FulfillmentStatus): FulfillmentEvent {
        if (!status.canTransitionTo(to)) {
            throw InvalidFulfillmentStateException(status, to)
        }
        val from = status
        status = to
        if (to == FulfillmentStatus.CANCELLED) lines.forEach { it.cancel() }
        return when (to) {
            FulfillmentStatus.SHIPPED -> FulfillmentEvent.Shipped(id, orderId)
            FulfillmentStatus.DELIVERED -> FulfillmentEvent.Delivered(id, orderId)
            FulfillmentStatus.CANCELLED -> FulfillmentEvent.Cancelled(id, orderId)
            else -> FulfillmentEvent.StatusChanged(id, orderId, from, to)
        }
    }

    fun cancel(): FulfillmentEvent.Cancelled {
        if (!status.canTransitionTo(FulfillmentStatus.CANCELLED)) {
            throw InvalidFulfillmentStateException(status, FulfillmentStatus.CANCELLED)
        }
        status = FulfillmentStatus.CANCELLED
        lines.forEach { it.cancel() }
        return FulfillmentEvent.Cancelled(id, orderId)
    }

    /**
     * 클레임의 라인 취소. 출고 전(PENDING·PICKING·PACKING)이면 [productIds] 의 라인을 취소하고, 남은 라인이 없으면
     * 이행 전체를 CANCELLED 로 둔다. 이미 출고(SHIPPED·DELIVERED)됐으면 아무것도 바꾸지 않고 거절한다.
     */
    fun cancelLines(productIds: Set<Long>): LineCancelResult {
        if (status == FulfillmentStatus.SHIPPED || status == FulfillmentStatus.DELIVERED) return LineCancelResult.Rejected(status)
        val targets = lines.filter { it.productId in productIds && it.getStatus() == FulfillmentLineStatus.ACTIVE }
        targets.forEach { it.cancel() }
        val whole = status != FulfillmentStatus.CANCELLED && lines.none { it.getStatus() == FulfillmentLineStatus.ACTIVE }
        if (whole) status = FulfillmentStatus.CANCELLED
        return LineCancelResult.Cancelled(targets, whole)
    }

    fun getLines(): List<FulfillmentLine> = lines

    fun getStatus(): FulfillmentStatus = status
}
