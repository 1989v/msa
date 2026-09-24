package com.kgd.payment.domain.payment.model

/**
 * 결제 상태 (스펙 SR-2).
 *
 * READY → AUTHORIZED | FAILED | UNKNOWN · UNKNOWN → AUTHORIZED | FAILED · AUTHORIZED → CAPTURED | VOIDED ·
 * CAPTURED → PARTIALLY_REFUNDED | REFUNDED · PARTIALLY_REFUNDED → PARTIALLY_REFUNDED | REFUNDED.
 * REFUNDED · VOIDED · FAILED 는 종착.
 */
enum class PaymentStatus {
    READY,
    AUTHORIZED,
    FAILED,
    UNKNOWN,
    CAPTURED,
    VOIDED,
    PARTIALLY_REFUNDED,
    REFUNDED,
    ;

    fun canTransitionTo(target: PaymentStatus): Boolean = target in allowedNext()

    val isTerminal: Boolean get() = allowedNext().isEmpty()

    /** PG 결과를 아직 모르는 상태 — 재조회 대상 */
    val isPending: Boolean get() = this == READY || this == UNKNOWN

    /** 매입이 끝난 상태 — 대사·환불 대상 */
    val isCaptured: Boolean get() = this == CAPTURED || this == PARTIALLY_REFUNDED || this == REFUNDED

    private fun allowedNext(): Set<PaymentStatus> = when (this) {
        READY -> setOf(AUTHORIZED, FAILED, UNKNOWN)
        UNKNOWN -> setOf(AUTHORIZED, FAILED)
        AUTHORIZED -> setOf(CAPTURED, VOIDED)
        CAPTURED -> setOf(PARTIALLY_REFUNDED, REFUNDED)
        PARTIALLY_REFUNDED -> setOf(PARTIALLY_REFUNDED, REFUNDED)
        FAILED, VOIDED, REFUNDED -> emptySet()
    }
}
