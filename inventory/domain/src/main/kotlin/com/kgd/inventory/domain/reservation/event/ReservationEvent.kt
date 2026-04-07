package com.kgd.inventory.domain.reservation.event

sealed class ReservationEvent {
    data class Expired(
        val reservationId: Long,
        val orderId: Long,
        val productId: Long,
        val warehouseId: Long,
        val qty: Int,
    ) : ReservationEvent()
}
