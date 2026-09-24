package com.kgd.order.domain.claim.model

import com.kgd.order.domain.claim.exception.InvalidClaimTransitionException
import com.kgd.order.domain.saga.model.SagaTiming
import java.time.Instant

/** 클레임 상태 (스펙 SR-2): REQUESTED → APPROVED → REFUNDED · REQUESTED → REJECTED */
enum class ClaimStatus {
    REQUESTED,
    APPROVED,
    REFUNDED,
    REJECTED;

    val open: Boolean get() = this == REQUESTED || this == APPROVED
}

/**
 * 클레임 처리 단계. 한 주문에서 답을 기다리는([awaitsAnswer]) 클레임은 하나뿐이다 — 이행·재고·혜택·결제의 답에는
 * 클레임 id 가 없어서(키 = orderId) 주문 안에서 기다리는 클레임이 하나여야 답의 주인이 정해진다. 나머지는 QUEUED 로 줄 선다.
 */
enum class ClaimStep(val awaitsAnswer: Boolean) {
    /** 앞선 클레임이 답을 기다리는 중 */
    QUEUED(false),

    /** 주문이 CONFIRMED — 이행 생성 명령이 이미 나갔다. 이행이 생긴 뒤 취소 명령을 낸다(생기기 전에 환불하면 취소된 상품이 출고된다) */
    FULFILLMENT_WAIT(true),
    FULFILLMENT_CANCEL(true),

    /** 이미 출고 — 판매자 승인(반품 수령 확인) 대기 */
    SELLER_DECISION(false),
    INVENTORY_RESTOCK(true),
    PROMOTION_RESTORE(true),
    PAYMENT_REFUND(true),
    DONE(false),
}

/** 기한 점검 결과 */
enum class ClaimDeadlineDecision { NOT_DUE, WAIT_FULFILLMENT, REISSUE, STUCK }

/**
 * 클레임 — 주문 한 건에서 **한 판매자**의 라인 묶음을 취소·환불한다. 전체 취소도 판매자마다 한 건씩 만든다 —
 * 판매자 승인·배송비 환불·출고 여부가 판매자 단위라서다.
 *
 * 흐름: (이행 대기) → 이행 취소 명령 → cancelled 면 자동 승인, cancel-rejected(출고) 면 판매자 결정 →
 * 승인이면 재입고(출고 전만) → 혜택 원복(포인트·전체 취소 쿠폰) → PG 환불(0원이면 생략) → REFUNDED.
 * 금액([pgRefund] 등)은 승인 뒤 환불 단계에 들어갈 때 정한다 — 그 시점에야 출고 여부와 다른 라인의 취소 여부가 확정된다.
 */
class Claim private constructor(
    val id: Long?,
    val orderId: Long,
    val userId: String,
    val sellerId: Long,
    val lineNos: List<Int>,
    status: ClaimStatus,
    step: ClaimStep,
    goodsShipped: Boolean,
    pgRefund: Long?,
    pointRestore: Long?,
    shippingRefund: Long?,
    fullCancel: Boolean?,
    restorePromotion: Boolean?,
    rejectReason: String?,
    decidedBy: String?,
    attempts: Int,
    nextDeadlineAt: Instant?,
    stuck: Boolean,
    val requestedAt: Instant,
    val version: Long,
) {
    init {
        require(lineNos.isNotEmpty()) { "클레임 라인이 비었다" }
    }

    var status: ClaimStatus = status; private set
    var step: ClaimStep = step; private set

    /** 판매자 승인 경로(출고 뒤)로 승인됐다 — 재입고하지 않고 배송비를 환불하지 않는다 */
    var goodsShipped: Boolean = goodsShipped; private set
    var pgRefund: Long? = pgRefund; private set
    var pointRestore: Long? = pointRestore; private set
    var shippingRefund: Long? = shippingRefund; private set
    var fullCancel: Boolean? = fullCancel; private set
    var restorePromotion: Boolean? = restorePromotion; private set
    var rejectReason: String? = rejectReason; private set
    var decidedBy: String? = decidedBy; private set
    var attempts: Int = attempts; private set
    var nextDeadlineAt: Instant? = nextDeadlineAt; private set

    /** 재시도 한도를 넘어 멈췄다 — 운영 이슈로 넘어갔고 스케줄러가 더 보지 않는다 */
    var stuck: Boolean = stuck; private set

    val awaitingAnswer: Boolean get() = status.open && step.awaitsAnswer && !stuck

    /** 재입고·원복·환불의 멱등 키 — 같은 클레임의 명령이 여러 번 가도 효과는 한 번 */
    val idempotencyKey: String get() = "claim:${requireNotNull(id) { "저장되지 않은 클레임" }}"

    /** 줄에서 나와 처리를 시작한다 — 이행이 있으면 취소 명령, 아직 생기는 중이면 대기 */
    fun start(fulfillmentExists: Boolean, now: Instant, timing: SagaTiming) {
        expect(ClaimStatus.REQUESTED, ClaimStep.QUEUED)
        enter(if (fulfillmentExists) ClaimStep.FULFILLMENT_CANCEL else ClaimStep.FULFILLMENT_WAIT, now, timing)
    }

    fun fulfillmentCreated(now: Instant, timing: SagaTiming) {
        expect(ClaimStatus.REQUESTED, ClaimStep.FULFILLMENT_WAIT)
        enter(ClaimStep.FULFILLMENT_CANCEL, now, timing)
    }

    /** 이행 도메인이 출고 전 라인을 취소했다 — 자동 승인 */
    fun approveAutomatically() {
        expect(ClaimStatus.REQUESTED, ClaimStep.FULFILLMENT_CANCEL)
        status = ClaimStatus.APPROVED
        decidedBy = SYSTEM
    }

    /** 이미 출고 — 판매자 결정을 기다린다 */
    fun awaitSeller() {
        expect(ClaimStatus.REQUESTED, ClaimStep.FULFILLMENT_CANCEL)
        step = ClaimStep.SELLER_DECISION
        nextDeadlineAt = null
    }

    /** 판매자 승인 — 반품을 따로 받았다는 뜻. 재입고 없이 환불로 간다. 다른 클레임이 답을 기다리면 줄 선다 */
    fun approveBySeller(actor: String) {
        expect(ClaimStatus.REQUESTED, ClaimStep.SELLER_DECISION)
        status = ClaimStatus.APPROVED
        goodsShipped = true
        decidedBy = actor
        step = ClaimStep.QUEUED
    }

    fun rejectBySeller(actor: String, reason: String) {
        expect(ClaimStatus.REQUESTED, ClaimStep.SELLER_DECISION)
        require(reason.isNotBlank()) { "반려 사유가 필요합니다" }
        status = ClaimStatus.REJECTED
        step = ClaimStep.DONE
        rejectReason = reason.take(500)
        decidedBy = actor
    }

    /** 승인된 클레임이 환불 단계에 들어간다 — 금액을 정하고 첫 단계를 돌려준다. 할 일이 없으면 바로 REFUNDED(DONE) */
    fun beginRefund(plan: ClaimRefundPlan, now: Instant, timing: SagaTiming): ClaimStep {
        if (status != ClaimStatus.APPROVED || (step != ClaimStep.FULFILLMENT_CANCEL && step != ClaimStep.QUEUED)) {
            throw InvalidClaimTransitionException("$status/$step 에서 환불 시작")
        }
        require(plan.lines.map { it.lineNo }.sorted() == lineNos.sorted()) { "환불 계획의 라인이 클레임과 다르다: claimId=$id" }
        pgRefund = plan.pgRefund
        pointRestore = plan.pointRestore
        shippingRefund = plan.shippingRefund
        fullCancel = plan.fullCancel
        restorePromotion = plan.restoresPromotion
        return proceedFrom(null, now, timing)
    }

    /** 지금 단계의 답이 왔다 — 다음 단계(없으면 DONE 과 REFUNDED)를 돌려준다 */
    fun completeStep(current: ClaimStep, now: Instant, timing: SagaTiming): ClaimStep {
        if (status != ClaimStatus.APPROVED || step != current) throw InvalidClaimTransitionException("$status/$step 에서 $current 완료")
        return proceedFrom(current, now, timing)
    }

    fun checkDeadline(now: Instant, timing: SagaTiming): ClaimDeadlineDecision {
        val due = nextDeadlineAt ?: return ClaimDeadlineDecision.NOT_DUE
        if (!awaitingAnswer || now.isBefore(due)) return ClaimDeadlineDecision.NOT_DUE
        if (step == ClaimStep.FULFILLMENT_WAIT) {
            nextDeadlineAt = now.plus(timing.stepTimeout)
            return ClaimDeadlineDecision.WAIT_FULFILLMENT
        }
        if (attempts >= timing.maxRetries) {
            stuck = true
            nextDeadlineAt = null
            return ClaimDeadlineDecision.STUCK
        }
        attempts += 1
        nextDeadlineAt = now.plus(timing.stepTimeout)
        return ClaimDeadlineDecision.REISSUE
    }

    /** 운영자 재개 — 멈춘 단계부터 시도 수를 비우고 기한 점검에 돌려보낸다 */
    fun resume(now: Instant, timing: SagaTiming) {
        if (!stuck || !status.open) throw InvalidClaimTransitionException("멈추지 않은 클레임은 재개할 수 없다: $status/$step, stuck=$stuck, claimId=$id")
        stuck = false
        enter(step, now, timing)
    }

    private fun proceedFrom(current: ClaimStep?, now: Instant, timing: SagaTiming): ClaimStep {
        val plan = refundSteps()
        val next = plan.getOrNull(if (current == null) 0 else plan.indexOf(current) + 1)
        if (next == null) {
            status = ClaimStatus.REFUNDED
            step = ClaimStep.DONE
            nextDeadlineAt = null
        } else {
            enter(next, now, timing)
        }
        return step
    }

    private fun refundSteps(): List<ClaimStep> = buildList {
        if (!goodsShipped) add(ClaimStep.INVENTORY_RESTOCK)
        if (restorePromotion == true) add(ClaimStep.PROMOTION_RESTORE)
        if ((pgRefund ?: 0L) > 0) add(ClaimStep.PAYMENT_REFUND)
    }

    private fun enter(next: ClaimStep, now: Instant, timing: SagaTiming) {
        step = next
        attempts = 0
        nextDeadlineAt = now.plus(timing.stepTimeout)
    }

    private fun expect(expectedStatus: ClaimStatus, expectedStep: ClaimStep) {
        if (status != expectedStatus || step != expectedStep) {
            throw InvalidClaimTransitionException("$status/$step (필요: $expectedStatus/$expectedStep), claimId=$id")
        }
    }

    companion object {
        const val SYSTEM = "SYSTEM"

        fun request(orderId: Long, userId: String, sellerId: Long, lineNos: List<Int>, now: Instant) = Claim(
            id = null, orderId = orderId, userId = userId, sellerId = sellerId, lineNos = lineNos.sorted(),
            status = ClaimStatus.REQUESTED, step = ClaimStep.QUEUED, goodsShipped = false, pgRefund = null, pointRestore = null,
            shippingRefund = null, fullCancel = null, restorePromotion = null, rejectReason = null, decidedBy = null,
            attempts = 0, nextDeadlineAt = null, stuck = false, requestedAt = now, version = 0L,
        )

        fun restore(
            id: Long?,
            orderId: Long,
            userId: String,
            sellerId: Long,
            lineNos: List<Int>,
            status: ClaimStatus,
            step: ClaimStep,
            goodsShipped: Boolean,
            pgRefund: Long?,
            pointRestore: Long?,
            shippingRefund: Long?,
            fullCancel: Boolean?,
            restorePromotion: Boolean?,
            rejectReason: String?,
            decidedBy: String?,
            attempts: Int,
            nextDeadlineAt: Instant?,
            stuck: Boolean,
            requestedAt: Instant,
            version: Long,
        ) = Claim(
            id, orderId, userId, sellerId, lineNos, status, step, goodsShipped, pgRefund, pointRestore, shippingRefund,
            fullCancel, restorePromotion, rejectReason, decidedBy, attempts, nextDeadlineAt, stuck, requestedAt, version,
        )
    }
}
