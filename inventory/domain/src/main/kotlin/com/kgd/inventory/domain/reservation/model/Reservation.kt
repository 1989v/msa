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
    private var restockedQty: Int = 0,
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
            restockedQty: Int = 0,
        ): Reservation = Reservation(
            id = id,
            orderId = orderId,
            productId = productId,
            warehouseId = warehouseId,
            qty = qty,
            status = status,
            expiredAt = expiredAt,
            createdAt = createdAt,
            restockedQty = restockedQty,
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

    /**
     * 확정된 수량 일부를 가용으로 되돌린다(출고 전 클레임·결제 뒤 보류 만료). 상태는 CONFIRMED 그대로 두고
     * 되돌린 합만 쌓는다 — 합이 예약 수량을 넘으면 같은 재고를 두 번 되돌리는 것이다.
     */
    fun restock(qty: Int) {
        if (status != ReservationStatus.CONFIRMED) throw InvalidReservationStateException(status, "restock")
        require(qty in 1..restockableQty()) { "재입고 수량이 남은 확정 수량을 넘습니다: requested=$qty, restockable=${restockableQty()}" }
        restockedQty += qty
    }

    fun restockableQty(): Int = if (status == ReservationStatus.CONFIRMED) qty - restockedQty else 0

    fun getRestockedQty(): Int = restockedQty

    fun isExpired(): Boolean = expiredAt.isBefore(LocalDateTime.now())

    fun getStatus(): ReservationStatus = status

    private fun requireActive(action: String) {
        if (status != ReservationStatus.ACTIVE) {
            throw InvalidReservationStateException(status, action)
        }
    }
}
