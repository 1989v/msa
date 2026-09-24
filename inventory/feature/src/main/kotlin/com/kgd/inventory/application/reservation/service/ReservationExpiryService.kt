package com.kgd.inventory.application.reservation.service

import tools.jackson.databind.ObjectMapper
import com.kgd.inventory.application.inventory.port.InventoryMetricsPort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.reservation.usecase.ExpireReservationsUseCase
import com.kgd.inventory.domain.inventory.event.InventoryEvent
import com.kgd.inventory.domain.reservation.event.ReservationEvent
import com.kgd.inventory.domain.reservation.model.Reservation
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ReservationExpiryService(
    private val reservationRepositoryPort: ReservationRepositoryPort,
    private val inventoryRepositoryPort: InventoryRepositoryPort,
    @Qualifier("inventoryOutboxPort") private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
    // ADR-0032 Phase 3 / PR-4 — TTL fallback 발화 메트릭. 정상 흐름이면 0 이어야 한다.
    // @Autowired(required = false) 로 노출해 Micrometer 미적재 환경(테스트 등)에서도 서비스 초기화가 가능.
    @Autowired(required = false)
    private val inventoryMetrics: InventoryMetricsPort? = null,
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
                if (expireAndRelease(reservation)) count++
            } catch (e: Exception) {
                log.error(e) { "Failed to expire reservation id=${reservation.id}" }
            }
        }
        return count
    }

    /**
     * 기한이 지난 ACTIVE 예약 하나를 만료시키고 가용을 되돌린다 — `inventory.stock.released` + `inventory.reservation.expired`
     * (키 orderId — 사가가 같은 파티션에서 받는다). 호출자의 트랜잭션 안에서 부른다. 재고 행이 없으면 false.
     */
    fun expireAndRelease(reservation: Reservation): Boolean {
        reservation.expire()
        reservationRepositoryPort.save(reservation)

        val inventory = inventoryRepositoryPort.findByProductIdAndWarehouseId(
            reservation.productId, reservation.warehouseId
        ) ?: return false

        inventory.release(reservation.qty)
        val savedInventory = inventoryRepositoryPort.save(inventory)

        // product 재고 캐시 동기화 — 해제와 같은 이벤트. 빠지면 만료 뒤로 product 재고가 적게 보인다.
        val stockReleased = InventoryEvent.StockReleased(
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = reservation.qty,
            orderId = reservation.orderId,
            availableQty = savedInventory.getAvailableQty(),
        )
        outboxPort.save(
            "Inventory",
            requireNotNull(savedInventory.id) { "저장된 재고의 ID가 null입니다" },
            "inventory.stock.released",
            objectMapper.writeValueAsString(stockReleased),
        )

        val reservationId = requireNotNull(reservation.id) { "저장된 예약의 ID가 null입니다" }
        val event = ReservationEvent.Expired(
            reservationId = reservationId,
            orderId = reservation.orderId,
            productId = reservation.productId,
            warehouseId = reservation.warehouseId,
            qty = reservation.qty,
        )
        outboxPort.save(
            aggregateType = "Reservation",
            aggregateId = reservationId,
            eventType = "inventory.reservation.expired",
            payload = objectMapper.writeValueAsString(event),
            partitionKey = reservation.orderId.toString(),
            headers = emptyMap(),
        )
        // ADR-0032 Phase 3 / PR-4 — fallback 발화 시점 카운터 증가.
        inventoryMetrics?.incrementReservationExpired(reservation.warehouseId)
        return true
    }
}
