package com.kgd.inventory.domain.reservation.model

import com.kgd.inventory.domain.reservation.exception.InvalidReservationStateException
import java.time.LocalDateTime

class Reservation private constructor(
    val id: Long?,
    val orderId: Long,
    val productId: Long,
    val warehouseId: Long,
    val qty: Int,
    private var status: ReservationStatus,
    val expiredAt: LocalDateTime,
    val createdAt: LocalDateTime,
) {
    companion object {
        fun create(
            orderId: Long,
            productId: Long,
            warehouseId: Long,
            qty: Int,
            ttlMinutes: Long = 30,
        ): Reservation {
            val now = LocalDateTime.now()
            return Reservation(
                id = null,
                orderId = orderId,
                productId = productId,
                warehouseId = warehouseId,
                qty = qty,
                status = ReservationStatus.ACTIVE,
                expiredAt = now.plusMinutes(ttlMinutes),
                createdAt = now,
            )
        }

        fun restore(
            id: Long,
            orderId: Long,
            productId: Long,
            warehouseId: Long,
            qty: Int,
            status: ReservationStatus,
            expiredAt: LocalDateTime,
            createdAt: LocalDateTime,
        ): Reservation = Reservation(
            id = id,
            orderId = orderId,
            productId = productId,
            warehouseId = warehouseId,
            qty = qty,
            status = status,
            expiredAt = expiredAt,
            createdAt = createdAt,
        )
    }

    fun confirm() {
        requireActive("confirm")
        status = ReservationStatus.CONFIRMED
    }

    fun cancel() {
        requireActive("cancel")
        status = ReservationStatus.CANCELLED
    }

    fun expire() {
        requireActive("expire")
        if (!isExpired()) {
            throw IllegalStateException("만료 시간이 아직 지나지 않았습니다")
        }
        status = ReservationStatus.EXPIRED
    }

    fun isExpired(): Boolean = expiredAt.isBefore(LocalDateTime.now())

    fun getStatus(): ReservationStatus = status

    private fun requireActive(action: String) {
        if (status != ReservationStatus.ACTIVE) {
            throw InvalidReservationStateException(status, action)
        }
    }
}
