package com.kgd.fulfillment.domain.fulfillment.model

import com.kgd.fulfillment.domain.fulfillment.event.FulfillmentEvent
import com.kgd.fulfillment.domain.fulfillment.exception.InvalidFulfillmentStateException
import java.time.LocalDateTime

class FulfillmentOrder private constructor(
    val id: Long? = null,
    val orderId: Long,
    val warehouseId: Long,
    private var status: FulfillmentStatus,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(orderId: Long, warehouseId: Long): FulfillmentOrder {
            return FulfillmentOrder(
                orderId = orderId,
                warehouseId = warehouseId,
                status = FulfillmentStatus.PENDING
            )
        }

        fun restore(
            id: Long?,
            orderId: Long,
            warehouseId: Long,
            status: FulfillmentStatus,
            createdAt: LocalDateTime
        ): FulfillmentOrder = FulfillmentOrder(
            id = id,
            orderId = orderId,
            warehouseId = warehouseId,
            status = status,
            createdAt = createdAt
        )
    }

    fun transition(to: FulfillmentStatus): FulfillmentEvent {
        if (!status.canTransitionTo(to)) {
            throw InvalidFulfillmentStateException(status, to)
        }
        val from = status
        status = to
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
        return FulfillmentEvent.Cancelled(id, orderId)
    }

    fun getStatus(): FulfillmentStatus = status
}
