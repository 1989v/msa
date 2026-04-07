package com.kgd.fulfillment.domain.fulfillment.model

enum class FulfillmentStatus {
    PENDING, PICKING, PACKING, SHIPPED, DELIVERED, CANCELLED;

    fun canTransitionTo(next: FulfillmentStatus): Boolean = when (this) {
        PENDING -> next == PICKING || next == CANCELLED
        PICKING -> next == PACKING || next == CANCELLED
        PACKING -> next == SHIPPED || next == CANCELLED
        SHIPPED -> next == DELIVERED
        DELIVERED, CANCELLED -> false
    }
}
