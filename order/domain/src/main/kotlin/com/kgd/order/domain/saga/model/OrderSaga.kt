package com.kgd.order.domain.saga.model

import com.kgd.order.domain.order.model.OrderFailureReason
import com.kgd.order.domain.saga.exception.InvalidSagaTransitionException
import java.time.Instant

/**
 * 주문 하나의 사가 진행 상태. 코디네이터가 이벤트를 받아 이 객체를 옮기고, 같은 트랜잭션에서 다음 명령을 아웃박스로 낸다.
 * 저장은 `order_saga` 행 하나(`@Version`) — 같은 주문의 이벤트가 동시에 오면 한쪽이 충돌로 다시 읽는다.
 */
class OrderSaga private constructor(
    val orderId: Long,
    /** 가맹점 주문번호 = 결제 시도 id. 결제의 멱등 키 */
    val orderNo: String,
    /** 결제액이 있는가 — 0원이면 결제 단계를 건너뛴다 */
    val paymentRequired: Boolean,
    status: SagaStatus,
    step: SagaStep,
    attempts: Int,
    nextDeadlineAt: Instant,
    val startedAt: Instant,
    val prePivotDeadlineAt: Instant,
    pendingVoid: Boolean,
    holdsExpired: Boolean,
    paymentUnknown: Boolean,
    inventoryConfirmed: Boolean,
    promotionConfirmed: Boolean,
    cancelRequested: Boolean,
    compensationPlan: List<SagaStep>,
    failureReason: OrderFailureReason?,
    reservedLines: List<ReservedLine>,
    val version: Long,
) {
    var status: SagaStatus = status
        private set
    var step: SagaStep = step
        private set
    var attempts: Int = attempts
        private set
    var nextDeadlineAt: Instant = nextDeadlineAt
        private set

    /** 결제 결론 전에 VOID 를 요청했다(보류 만료 규칙 b · 결제 단계 기한 초과). 결제가 결론 시 실행한다 */
    var pendingVoid: Boolean = pendingVoid
        private set
    var holdsExpired: Boolean = holdsExpired
        private set
    var paymentUnknown: Boolean = paymentUnknown
        private set
    var inventoryConfirmed: Boolean = inventoryConfirmed
        private set
    var promotionConfirmed: Boolean = promotionConfirmed
        private set

    /** 구매자 취소로 보상 중 — 끝나면 주문은 FAILED 가 아니라 CANCELLED */
    var cancelRequested: Boolean = cancelRequested
        private set

    /** 지금 보상 단계 다음에 남은 보상 단계 */
    var compensationPlan: List<SagaStep> = compensationPlan
        private set
    var failureReason: OrderFailureReason? = failureReason
        private set
    var reservedLines: List<ReservedLine> = reservedLines
        private set

    /** 정방향 다음 단계로 — 뒤로 가거나 보상 단계로는 못 간다 */
    fun advance(next: SagaStep, now: Instant, timing: SagaTiming) {
        requireStatus(SagaStatus.RUNNING)
        if (next.phase == SagaPhase.COMPENSATION || SagaStep.FORWARD.indexOf(next) <= SagaStep.FORWARD.indexOf(step)) {
            throw InvalidSagaTransitionException("$step → $next")
        }
        if (next.isPayment && !paymentRequired) throw InvalidSagaTransitionException("0원 주문은 결제 단계가 없다: $next")
        enter(next, now, timing)
    }

    fun complete() {
        if (step != SagaStep.FULFILLMENT_CREATE) throw InvalidSagaTransitionException("$step 에서 완료")
        move(SagaStatus.COMPLETED)
    }

    /**
     * 실패 — 이미 한 것을 역순으로 되돌린다. [includeCurrent] 는 지금 단계의 효과가 있을 수 있는지
     * (자기 실패 답이면 false, 기한 초과·구매자 취소·보류 만료면 true). 첫 보상 단계를 돌려주고, 없으면 바로 FAILED.
     */
    fun failAt(reason: OrderFailureReason, includeCurrent: Boolean, now: Instant, timing: SagaTiming): SagaStep? {
        requireStatus(SagaStatus.RUNNING)
        val plan = undoPlan(includeCurrent)
        pendingVoid = SagaStep.PAYMENT_VOID in plan && step == SagaStep.PAYMENT_AUTHORIZE
        failureReason = reason
        move(SagaStatus.COMPENSATING)
        if (plan.isEmpty()) {
            move(SagaStatus.FAILED)
            return null
        }
        compensationPlan = plan.drop(1)
        enter(plan.first(), now, timing)
        return plan.first()
    }

    /** 지금 보상 단계가 끝났다 — 다음 보상 단계를 돌려주고, 없으면 FAILED */
    fun nextCompensation(now: Instant, timing: SagaTiming): SagaStep? {
        requireStatus(SagaStatus.COMPENSATING)
        val next = compensationPlan.firstOrNull()
        if (next == null) {
            move(SagaStatus.FAILED)
            return null
        }
        compensationPlan = compensationPlan.drop(1)
        enter(next, now, timing)
        return next
    }

    /**
     * 보상 중 확정 사실이 늦게 왔다 — 해제 대신 재입고, 취소 대신 원복. 지금 단계가 바뀌었으면 true(명령을 새로 낸다).
     * 남은 계획 안에 있으면 그 자리만 바꾸고 false.
     */
    fun switchCompensation(from: SagaStep, to: SagaStep, now: Instant, timing: SagaTiming): Boolean {
        require(
            (from == SagaStep.INVENTORY_RELEASE && to == SagaStep.INVENTORY_RESTOCK) ||
                (from == SagaStep.PROMOTION_CANCEL && to == SagaStep.PROMOTION_RESTORE),
        ) { "바꿀 수 없는 보상: $from → $to" }
        if (status != SagaStatus.COMPENSATING) return false
        if (step == from) {
            enter(to, now, timing)
            return true
        }
        compensationPlan = compensationPlan.map { if (it == from) to else it }
        return false
    }

    /**
     * 기한 점검. 지나지 않았으면 NOT_DUE. 피벗 전 기한 초과는 결제 미상이 아니면 보상으로, 그 밖은 재발행(시도 +1),
     * 한도를 넘으면 STUCK 으로 옮긴다.
     */
    fun checkDeadline(now: Instant, timing: SagaTiming): DeadlineDecision {
        if (!status.active || now.isBefore(nextDeadlineAt)) return DeadlineDecision.NOT_DUE
        if (step == SagaStep.PAYMENT_AUTHORIZE && paymentUnknown) {
            nextDeadlineAt = now.plus(timing.stepTimeout)
            return DeadlineDecision.WAIT
        }
        if (step == SagaStep.PAYMENT_VOID && pendingVoid && paymentUnknown) {
            nextDeadlineAt = now.plus(timing.stepTimeout)
            return DeadlineDecision.REISSUE_WAITING
        }
        if (status == SagaStatus.RUNNING && step.phase == SagaPhase.PRE_PIVOT && !now.isBefore(prePivotDeadlineAt)) {
            return DeadlineDecision.PRE_PIVOT_EXPIRED
        }
        if (attempts >= timing.maxRetries) {
            move(SagaStatus.STUCK)
            return DeadlineDecision.STUCK
        }
        attempts += 1
        nextDeadlineAt = now.plus(timing.stepTimeout)
        return DeadlineDecision.REISSUE
    }

    /** 운영자 재시도 — 멈춘 단계부터 다시 */
    fun resume(now: Instant, timing: SagaTiming) {
        requireStatus(SagaStatus.STUCK)
        move(if (step.phase == SagaPhase.COMPENSATION) SagaStatus.COMPENSATING else SagaStatus.RUNNING)
        enter(step, now, timing)
    }

    fun markInventoryReserved(lines: List<ReservedLine>) {
        reservedLines = lines
    }

    fun markInventoryConfirmed(lines: List<ReservedLine>) {
        inventoryConfirmed = true
        if (lines.isNotEmpty()) reservedLines = lines
    }

    fun markPromotionConfirmed() {
        promotionConfirmed = true
    }

    fun markPaymentUnknown() {
        paymentUnknown = true
    }

    fun markPaymentConcluded() {
        paymentUnknown = false
    }

    fun markHoldsExpired() {
        holdsExpired = true
    }

    fun requestCancel() {
        requireStatus(SagaStatus.RUNNING)
        cancelRequested = true
    }

    /** 지금까지 효과를 남겼을 수 있는 단계를 역순으로 되돌리는 계획. 확정된 것은 해제·취소가 아니라 재입고·원복 */
    private fun undoPlan(includeCurrent: Boolean): List<SagaStep> {
        val index = SagaStep.FORWARD.indexOf(step)
        val done = SagaStep.FORWARD.take(if (includeCurrent) index + 1 else index)
        return done.reversed().mapNotNull {
            when (it) {
                SagaStep.PAYMENT_AUTHORIZE -> SagaStep.PAYMENT_VOID
                SagaStep.PROMOTION_RESERVE -> if (promotionConfirmed) SagaStep.PROMOTION_RESTORE else SagaStep.PROMOTION_CANCEL
                SagaStep.INVENTORY_RESERVE -> if (inventoryConfirmed) SagaStep.INVENTORY_RESTOCK else SagaStep.INVENTORY_RELEASE
                else -> null
            }
        }.filter { it != SagaStep.PAYMENT_VOID || paymentRequired }
    }

    private fun enter(next: SagaStep, now: Instant, timing: SagaTiming) {
        step = next
        attempts = 0
        nextDeadlineAt = now.plus(timing.stepTimeout)
    }

    private fun requireStatus(expected: SagaStatus) {
        if (status != expected) throw InvalidSagaTransitionException("$status 에서는 할 수 없다(필요: $expected), step=$step")
    }

    private fun move(next: SagaStatus) {
        if (!status.canMoveTo(next)) throw InvalidSagaTransitionException("$status → $next")
        status = next
    }

    companion object {
        fun start(orderId: Long, orderNo: String, paymentRequired: Boolean, now: Instant, timing: SagaTiming) = OrderSaga(
            orderId = orderId, orderNo = orderNo, paymentRequired = paymentRequired, status = SagaStatus.RUNNING,
            step = SagaStep.INVENTORY_RESERVE, attempts = 0, nextDeadlineAt = now.plus(timing.stepTimeout),
            startedAt = now, prePivotDeadlineAt = now.plus(timing.prePivotBudget), pendingVoid = false,
            holdsExpired = false, paymentUnknown = false, inventoryConfirmed = false, promotionConfirmed = false,
            cancelRequested = false, compensationPlan = emptyList(), failureReason = null, reservedLines = emptyList(),
            version = 0L,
        )

        /** 가맹점 주문번호 — 주문당 결제 시도는 하나라 접미사는 1 */
        fun orderNoOf(orderId: Long) = "ORD-$orderId-1"

        fun restore(
            orderId: Long,
            orderNo: String,
            paymentRequired: Boolean,
            status: SagaStatus,
            step: SagaStep,
            attempts: Int,
            nextDeadlineAt: Instant,
            startedAt: Instant,
            prePivotDeadlineAt: Instant,
            pendingVoid: Boolean,
            holdsExpired: Boolean,
            paymentUnknown: Boolean,
            inventoryConfirmed: Boolean,
            promotionConfirmed: Boolean,
            cancelRequested: Boolean,
            compensationPlan: List<SagaStep>,
            failureReason: OrderFailureReason?,
            reservedLines: List<ReservedLine>,
            version: Long,
        ) = OrderSaga(
            orderId, orderNo, paymentRequired, status, step, attempts, nextDeadlineAt, startedAt, prePivotDeadlineAt,
            pendingVoid, holdsExpired, paymentUnknown, inventoryConfirmed, promotionConfirmed, cancelRequested,
            compensationPlan, failureReason, reservedLines, version,
        )
    }
}
