package com.kgd.fulfillment.domain.fulfillment.event

import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus

sealed class FulfillmentEvent {
    abstract val fulfillmentId: Long?
    abstract val orderId: Long

    data class Created(
        override val fulfillmentId: Long?,
        override val orderId: Long,
        val warehouseId: Long
    ) : FulfillmentEvent()

    data class StatusChanged(
        override val fulfillmentId: Long?,
        override val orderId: Long,
        val from: FulfillmentStatus,
        val to: FulfillmentStatus
    ) : FulfillmentEvent()

    data class Shipped(
        override val fulfillmentId: Long?,
        override val orderId: Long
    ) : FulfillmentEvent()

    data class Delivered(
        override val fulfillmentId: Long?,
        override val orderId: Long
    ) : FulfillmentEvent()

    data class Cancelled(
        override val fulfillmentId: Long?,
        override val orderId: Long
    ) : FulfillmentEvent()
}
