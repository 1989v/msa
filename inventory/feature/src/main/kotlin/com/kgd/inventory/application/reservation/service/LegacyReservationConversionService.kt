package com.kgd.inventory.application.reservation.service

import com.kgd.inventory.application.inventory.port.ReservationRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.reservation.port.CommandAnswerRepositoryPort
import com.kgd.inventory.application.reservation.port.MigrationMarkerPort
import com.kgd.inventory.application.reservation.usecase.ConvertLegacyReservationsUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 확정은 결제 승인 뒤 사가가 명령으로 하므로, 옛 흐름에서 ACTIVE 로 남은 예약(출고 때 확정되던 것)은 영영 확정되지 않고
 * 30분 뒤 만료돼 결제된 주문의 재고가 다시 팔린다. 그래서 한 번 확정해 둔다 — 확정과 같은 수량 처리
 * (`reserved_qty` 차감)와 `inventory.stock.confirmed` 를 [ConfirmStockByOrderUseCase] 로 그대로 낸다.
 *
 * 사가가 예약한 주문(답 원장에 RESERVE 가 있는 주문)은 건드리지 않는다.
 */
@Service
class LegacyReservationConversionService(
    private val reservations: ReservationRepositoryPort,
    private val answers: CommandAnswerRepositoryPort,
    private val markers: MigrationMarkerPort,
    private val confirmStockByOrder: ConfirmStockByOrderUseCase,
) : ConvertLegacyReservationsUseCase {
    private val log = KotlinLogging.logger {}

    @Transactional("inventoryTransactionManager")
    override fun convert(): Int? {
        if (markers.exists(MARKER)) return null
        val orderIds = reservations.findAllActive().map { it.orderId }.distinct()
            .filterNot { answers.existsReserveAnswer(it) }
        orderIds.forEach { confirmStockByOrder.execute(ConfirmStockByOrderUseCase.Command(it)) }
        markers.mark(MARKER)
        log.info { "옛 흐름 ACTIVE 예약 확정 전환: orders=${orderIds.size}" }
        return orderIds.size
    }

    companion object {
        const val MARKER = "legacy-active-reservation-confirm"
    }
}
