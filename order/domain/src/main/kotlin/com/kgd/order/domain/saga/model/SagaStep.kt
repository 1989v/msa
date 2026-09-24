package com.kgd.order.domain.saga.model

import java.time.Duration

enum class SagaPhase { PRE_PIVOT, POST_PIVOT, COMPENSATION }

/**
 * 사가 단계 (스펙 SR-4). 정방향은 재고 예약 → 혜택 예약 → 결제 승인(피벗) → 재고 확정 → 혜택 확정 → 결제 매입 → 이행 생성.
 * 결제액 0원이면 결제 단계 둘을 건너뛴다. 보상 단계는 이미 한 것을 역순으로 되돌린다.
 */
enum class SagaStep(val phase: SagaPhase) {
    INVENTORY_RESERVE(SagaPhase.PRE_PIVOT),
    PROMOTION_RESERVE(SagaPhase.PRE_PIVOT),
    PAYMENT_AUTHORIZE(SagaPhase.PRE_PIVOT),
    INVENTORY_CONFIRM(SagaPhase.POST_PIVOT),
    PROMOTION_CONFIRM(SagaPhase.POST_PIVOT),
    PAYMENT_CAPTURE(SagaPhase.POST_PIVOT),
    FULFILLMENT_CREATE(SagaPhase.POST_PIVOT),

    PAYMENT_VOID(SagaPhase.COMPENSATION),
    PROMOTION_CANCEL(SagaPhase.COMPENSATION),
    PROMOTION_RESTORE(SagaPhase.COMPENSATION),
    INVENTORY_RELEASE(SagaPhase.COMPENSATION),
    INVENTORY_RESTOCK(SagaPhase.COMPENSATION);

    val isPayment: Boolean get() = this == PAYMENT_AUTHORIZE || this == PAYMENT_CAPTURE

    companion object {
        val FORWARD: List<SagaStep> = entries.filter { it.phase != SagaPhase.COMPENSATION }
    }
}

/**
 * 사가 상태 (스펙 SR-2 사가 표): RUNNING → COMPENSATING → FAILED · RUNNING → COMPLETED · RUNNING → STUCK · STUCK → RUNNING.
 * 보상 단계도 재시도가 소진되면 멈추고 운영자가 재개하므로 COMPENSATING ↔ STUCK 두 줄을 더 둔다.
 */
enum class SagaStatus {
    RUNNING,
    COMPENSATING,
    COMPLETED,
    FAILED,
    STUCK;

    fun canMoveTo(next: SagaStatus): Boolean = when (this) {
        RUNNING -> next == COMPENSATING || next == COMPLETED || next == STUCK
        COMPENSATING -> next == FAILED || next == STUCK
        STUCK -> next == RUNNING || next == COMPENSATING
        COMPLETED, FAILED -> false
    }

    val active: Boolean get() = this == RUNNING || this == COMPENSATING
}

/**
 * 기한 정책. 단계마다 [stepTimeout] 이 지나면 같은 명령을 다시 내고(멱등), [maxRetries] 를 넘으면 STUCK.
 * 피벗 전 단계는 사가 시작부터 [prePivotBudget] 안에 끝나야 한다 — 재고·혜택 보류 30분보다 짧다.
 */
data class SagaTiming(val stepTimeout: Duration, val prePivotBudget: Duration, val maxRetries: Int)

/** 재고 확정 답의 라인 — 이행 생성 명령이 창고를 안다 */
data class ReservedLine(val productId: Long, val warehouseId: Long, val quantity: Int)

/** 기한 점검 결과 — 코디네이터가 이 값으로 할 일을 고른다 */
enum class DeadlineDecision {
    /** 기한 전이거나 끝난 사가 */
    NOT_DUE,

    /** 지금 단계 명령을 다시 낸다(시도 수 +1) */
    REISSUE,

    /** 결제 결과 미상 — 명령 없이 기다린다 */
    WAIT,

    /** VOID 예약 중 결제 미상 — VOID 를 다시 내되 시도 수는 세지 않는다(결론은 결제 재조회가 낸다) */
    REISSUE_WAITING,

    /** 피벗 전 기한 초과 — 보상으로 간다 */
    PRE_PIVOT_EXPIRED,

    /** 재시도 한도 초과 — 운영 이슈 */
    STUCK,
}
