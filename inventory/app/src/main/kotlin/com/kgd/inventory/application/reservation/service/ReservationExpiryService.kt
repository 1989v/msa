package com.kgd.inventory.application.reservation.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.reservation.usecase.ExpireReservationsUseCase
import com.kgd.inventory.domain.reservation.event.ReservationEvent
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ReservationExpiryService(
    private val reservationRepositoryPort: ReservationRepositoryPort,
    private val inventoryRepositoryPort: InventoryRepositoryPort,
    private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
) : ExpireReservationsUseCase {

    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedDelayString = "\${inventory.reservation.expiry-check-interval-ms:60000}")
    fun scheduledExpiry() {
        val count = execute()
        if (count > 0) {
            log.info("Expired {} reservations", count)
        }
    }

    @Transactional
    override fun execute(): Int {
        val expiredReservations = reservationRepositoryPort.findAllExpired()
        var count = 0

        for (reservation in expiredReservations) {
            try {
                reservation.expire()
                reservationRepositoryPort.save(reservation)

                // Release inventory
                val inventory = inventoryRepositoryPort.findByProductIdAndWarehouseId(
                    reservation.productId, reservation.warehouseId
                ) ?: continue

                inventory.release(reservation.qty)
                inventoryRepositoryPort.save(inventory)

                // Publish event
                val event = ReservationEvent.Expired(
                    reservationId = reservation.id!!,
                    orderId = reservation.orderId,
                    productId = reservation.productId,
                    warehouseId = reservation.warehouseId,
                    qty = reservation.qty,
                )
                outboxPort.save(
                    "Reservation",
                    reservation.id!!,
                    "inventory.reservation.expired",
                    objectMapper.writeValueAsString(event),
                )
                count++
            } catch (e: Exception) {
                log.error("Failed to expire reservation id={}", reservation.id, e)
            }
        }
        return count
    }
}
