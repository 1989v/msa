package com.kgd.inventory.infrastructure.persistence.reservation.entity

import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "reservation")
class ReservationJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val orderId: Long,

    @Column(nullable = false)
    val productId: Long,

    @Column(nullable = false)
    val warehouseId: Long,

    @Column(nullable = false)
    val qty: Int,

    @Column(nullable = false, length = 20)
    var status: String,

    @Column(nullable = false)
    val expiredAt: LocalDateTime,

    @Column(nullable = false)
    val createdAt: LocalDateTime,
) {
    fun toDomain(): Reservation = Reservation.restore(
        id = id!!,
        orderId = orderId,
        productId = productId,
        warehouseId = warehouseId,
        qty = qty,
        status = ReservationStatus.valueOf(status),
        expiredAt = expiredAt,
        createdAt = createdAt,
    )

    companion object {
        fun fromDomain(reservation: Reservation): ReservationJpaEntity = ReservationJpaEntity(
            id = reservation.id,
            orderId = reservation.orderId,
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = reservation.qty,
            status = reservation.getStatus().name,
            expiredAt = reservation.expiredAt,
            createdAt = reservation.createdAt,
        )
    }
}
