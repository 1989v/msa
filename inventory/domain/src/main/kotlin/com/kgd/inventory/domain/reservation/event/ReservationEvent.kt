package com.kgd.inventory.domain.reservation.event

import java.time.LocalDateTime

/**
 * `inventory.reservation.*` — 사가 명령(`inventory.command.*`)에 대한 답과 만료 알림. 키는 전부 orderId.
 * [command] 는 이 답을 부른 명령(RESERVE·CONFIRM·RELEASE·RESTOCK) — failed 가 어느 단계의 실패인지 가른다.
 */
sealed class ReservationEvent {
    data class Expired(
        val reservationId: Long,
        val orderId: Long,
        val productId: Long,
        val warehouseId: Long,
        val qty: Int,
    ) : ReservationEvent()

    /** 주문 단위 예약 실패 · 확정 불가(만료) · 해제 불가(이미 확정) · 재입고 불가. 효과는 하나도 남기지 않았다. */
    data class Failed(
        val orderId: Long,
        val reason: String,
        val shortages: List<Shortage> = emptyList(),
        val command: String = COMMAND_RESERVE,
    ) : ReservationEvent() {
        data class Shortage(val productId: Long, val requestedQty: Int, val availableQty: Int)
    }

    data class Reserved(
        val orderId: Long,
        val lines: List<Line>,
        val expiresAt: LocalDateTime,
        val command: String = COMMAND_RESERVE,
    ) : ReservationEvent()

    data class Confirmed(
        val orderId: Long,
        val lines: List<Line>,
        val command: String = COMMAND_CONFIRM,
    ) : ReservationEvent()

    /** 이 명령으로 해제한 라인. 해제할 ACTIVE 예약이 없었으면 빈 목록 — 보상 단계가 멈추지 않게 답은 한다 */
    data class Released(
        val orderId: Long,
        val lines: List<Line>,
        val command: String = COMMAND_RELEASE,
    ) : ReservationEvent()

    /** [lines] 의 quantity 는 이번에 가용으로 되돌린 수량 */
    data class Restocked(
        val orderId: Long,
        val restockKey: String?,
        val lines: List<Line>,
        val command: String = COMMAND_RESTOCK,
    ) : ReservationEvent()

    data class Line(val reservationId: Long, val productId: Long, val warehouseId: Long, val quantity: Int)

    companion object {
        const val COMMAND_RESERVE = "RESERVE"
        const val COMMAND_CONFIRM = "CONFIRM"
        const val COMMAND_RELEASE = "RELEASE"
        const val COMMAND_RESTOCK = "RESTOCK"

        const val REASON_INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK"
        const val REASON_EXPIRED = "EXPIRED"
        const val REASON_NOT_RESERVED = "NOT_RESERVED"
        const val REASON_ALREADY_CONFIRMED = "ALREADY_CONFIRMED"
        const val REASON_NOT_RESTOCKABLE = "NOT_RESTOCKABLE"

        /** 이 주문은 이미 해제(release)로 답했다 — 늦게 온 예약 명령으로 재고를 다시 잡지 않는다 */
        const val REASON_RELEASED = "RELEASED"
    }
}
