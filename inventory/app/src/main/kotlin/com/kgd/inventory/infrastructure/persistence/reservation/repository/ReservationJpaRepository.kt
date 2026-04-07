package com.kgd.inventory.infrastructure.persistence.reservation.repository

import com.kgd.inventory.infrastructure.persistence.reservation.entity.ReservationJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDateTime

interface ReservationJpaRepository : JpaRepository<ReservationJpaEntity, Long> {
    fun findByOrderIdAndProductId(orderId: Long, productId: Long): ReservationJpaEntity?
    fun findAllByStatusAndExpiredAtBefore(status: String, expiredAt: LocalDateTime): List<ReservationJpaEntity>
    fun findAllByOrderId(orderId: Long): List<ReservationJpaEntity>
}
