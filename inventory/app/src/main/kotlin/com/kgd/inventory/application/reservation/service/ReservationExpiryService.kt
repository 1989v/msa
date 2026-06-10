package com.kgd.inventory.application.reservation.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.inventory.application.inventory.port.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.reservation.usecase.ExpireReservationsUseCase
import com.kgd.inventory.domain.reservation.event.ReservationEvent
import com.kgd.inventory.infrastructure.metrics.InventoryMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ReservationExpiryService(
    private val reservationRepositoryPort: ReservationRepositoryPort,
    private val inventoryRepositoryPort: InventoryRepositoryPort,
    private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
    // ADR-0032 Phase 3 / PR-4 — TTL fallback 발화 메트릭. 정상 흐름이면 0 이어야 한다.
    // @Autowired(required = false) 로 노출해 Micrometer 미적재 환경(테스트 등)에서도 서비스 초기화가 가능.
    @Autowired(required = false)
    private val inventoryMetrics: InventoryMetrics? = null,
) : ExpireReservationsUseCase {

    private val log = KotlinLogging.logger {}

    @Scheduled(fixedDelayString = "\${inventory.reservation.expiry-check-interval-ms:60000}")
    fun scheduledExpiry() {
        val count = execute()
        if (count > 0) {
            log.info { "Expired $count reservations" }
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
                // ADR-0032 Phase 3 / PR-4 — fallback 발화 시점 카운터 증가.
                inventoryMetrics?.incrementReservationExpired(reservation.warehouseId)
                count++
            } catch (e: Exception) {
                log.error(e) { "Failed to expire reservation id=${reservation.id}" }
            }
        }
        return count
    }
}
