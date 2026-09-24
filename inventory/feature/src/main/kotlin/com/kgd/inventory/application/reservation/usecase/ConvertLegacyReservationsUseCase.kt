package com.kgd.inventory.application.reservation.usecase

/**
 * 옛 흐름(결제 뒤 예약)이 남긴 ACTIVE 예약을 확정으로 바꾼다 — 기동 시 한 번, 표식으로 두 번 돌지 않는다.
 * 옛 흐름의 예약은 전부 결제 완료 주문에서 생겼으므로 조건 없이 확정한다(스펙 SR-13).
 */
interface ConvertLegacyReservationsUseCase {
    /** @return 확정한 주문 수. 이미 돌았으면 null */
    fun convert(): Int?
}
