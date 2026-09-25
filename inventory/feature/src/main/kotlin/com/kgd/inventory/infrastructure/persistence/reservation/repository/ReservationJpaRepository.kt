package com.kgd.inventory.infrastructure.persistence.reservation.repository

import com.kgd.inventory.infrastructure.persistence.reservation.entity.ReservationJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDateTime

interface ReservationJpaRepository : JpaRepository<ReservationJpaEntity, Long> {
    fun findByOrderIdAndProductId(orderId: Long, productId: Long): ReservationJpaEntity?

    /**
     * ADR-0029 PR-8a — `(orderId, productId, status)` 로 ACTIVE Reservation 만 조회.
     *
     * 동일 `(orderId, productId)` 의 과거 CANCELLED/EXPIRED/CONFIRMED 가 존재해도 무시하고,
     * 현재 보유 중인 ACTIVE 1건만 반환한다 (도메인 불변식상 ACTIVE 는 동시 1건). 0건이면 null.
     */
    fun findFirstByOrderIdAndProductIdAndStatus(
        orderId: Long,
        productId: Long,
        status: String,
    ): ReservationJpaEntity?

    fun findAllByStatusAndExpiredAtBefore(status: String, expiredAt: LocalDateTime): List<ReservationJpaEntity>
    fun findAllByOrderId(orderId: Long): List<ReservationJpaEntity>
}
