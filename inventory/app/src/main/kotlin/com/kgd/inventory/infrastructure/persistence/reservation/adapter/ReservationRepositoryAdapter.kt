package com.kgd.inventory.infrastructure.persistence.reservation.adapter

import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.domain.reservation.model.Reservation
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import com.kgd.inventory.infrastructure.persistence.reservation.entity.ReservationJpaEntity
import com.kgd.inventory.infrastructure.persistence.reservation.repository.ReservationJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class ReservationRepositoryAdapter(
    private val jpaRepository: ReservationJpaRepository,
) : ReservationRepositoryPort {

    override fun save(reservation: Reservation): Reservation {
        val entity = ReservationJpaEntity.fromDomain(reservation)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findByOrderIdAndProductId(orderId: Long, productId: Long): Reservation? {
        return jpaRepository.findByOrderIdAndProductId(orderId, productId)?.toDomain()
    }

    override fun findAllExpired(): List<Reservation> {
        return jpaRepository.findAllByStatusAndExpiredAtBefore(
            ReservationStatus.ACTIVE.name,
            LocalDateTime.now(),
        ).map { it.toDomain() }
    }

    override fun findAllByOrderId(orderId: Long): List<Reservation> {
        return jpaRepository.findAllByOrderId(orderId).map { it.toDomain() }
    }
}
