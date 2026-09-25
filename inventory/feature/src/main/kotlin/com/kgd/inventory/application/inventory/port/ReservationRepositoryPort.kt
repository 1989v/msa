package com.kgd.inventory.application.inventory.port

import com.kgd.inventory.domain.reservation.model.Reservation

interface ReservationRepositoryPort {
    fun save(reservation: Reservation): Reservation
    fun findByOrderIdAndProductId(orderId: Long, productId: Long): Reservation?

    /**
     * ADR-0029 PR-8a — `ReserveStockUseCase` 자연 멱등 보강용.
     *
     * 같은 `(orderId, productId)` 로 재예약 시도 시 이미 ACTIVE 상태의 Reservation 이 존재하면
     * 새 Reservation 생성 + 이중 차감을 회피하기 위해 pre-check 에서 사용한다. CANCELLED/EXPIRED/CONFIRMED
     * 는 의도적으로 제외 — 같은 `(orderId, productId)` 로 다시 예약을 만들 수 있는 정상 시나리오.
     */
    fun findActiveByOrderIdAndProductId(orderId: Long, productId: Long): Reservation?

    fun findAllExpired(): List<Reservation>
    fun findAllByOrderId(orderId: Long): List<Reservation>
}
