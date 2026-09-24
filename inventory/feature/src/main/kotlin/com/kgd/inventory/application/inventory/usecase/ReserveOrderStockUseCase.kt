package com.kgd.inventory.application.inventory.usecase

/**
 * 한 주문의 재고 예약 — 모든 라인이 예약되거나 하나도 안 된다.
 *
 * 모자란 라인이 있으면 예외가 아니라 [Result.Failed] 로 끝나고 `inventory.reservation.failed` 가 발행된다.
 * 재고 부족은 재시도로 풀리지 않는 정상 결과라, 예외로 던지면 DLT 로 흘러가 아무도 모르게 멈춘다.
 */
interface ReserveOrderStockUseCase {
    fun execute(command: Command): Result

    data class Command(val orderId: Long, val lines: List<Line>)
    data class Line(val productId: Long, val qty: Int)

    sealed interface Result {
        data class Reserved(val lines: List<ReservedLine>) : Result
        data class Failed(val shortages: List<Shortage>) : Result
    }

    data class ReservedLine(val reservationId: Long, val productId: Long, val warehouseId: Long, val qty: Int)

    /** [availableQty] 는 한 창고에서 낼 수 있는 최대치 — 분할 출고를 하지 않으므로 창고 합계가 아니다. */
    data class Shortage(val productId: Long, val requestedQty: Int, val availableQty: Int)
}
