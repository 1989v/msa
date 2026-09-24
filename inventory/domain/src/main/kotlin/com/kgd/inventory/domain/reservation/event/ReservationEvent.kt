package com.kgd.inventory.domain.reservation.event

sealed class ReservationEvent {
    data class Expired(
        val reservationId: Long,
        val orderId: Long,
        val productId: Long,
        val warehouseId: Long,
        val qty: Int,
    ) : ReservationEvent()

    /** 주문 단위 예약 실패 — 예약 행은 하나도 만들지 않았다. */
    data class Failed(
        val orderId: Long,
        val reason: String,
        val shortages: List<Shortage>,
    ) : ReservationEvent() {
        data class Shortage(val productId: Long, val requestedQty: Int, val availableQty: Int)
    }
}
