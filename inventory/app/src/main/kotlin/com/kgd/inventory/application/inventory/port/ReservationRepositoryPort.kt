package com.kgd.inventory.application.inventory.port

import com.kgd.inventory.domain.reservation.model.Reservation

interface ReservationRepositoryPort {
    fun save(reservation: Reservation): Reservation
    fun findByOrderIdAndProductId(orderId: Long, productId: Long): Reservation?
    fun findAllExpired(): List<Reservation>
    fun findAllByOrderId(orderId: Long): List<Reservation>
}
