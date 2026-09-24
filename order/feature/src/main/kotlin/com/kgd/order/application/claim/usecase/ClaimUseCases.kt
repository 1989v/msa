package com.kgd.order.application.claim.usecase

import com.kgd.order.domain.claim.model.Claim
import java.time.Instant

/** 구매자 클레임 — 본인 주문만(남의 주문은 404). 판매자마다 한 건씩 만든다 */
interface RequestClaimUseCase {
    /** [lineNos] 가 null 이면 전체 취소(ACTIVE 라인 전부) */
    fun request(userId: String, orderId: Long, lineNos: List<Int>?): List<ClaimView>
}

/** 판매자 결정 — 출고 뒤 취소 요청(cancel-rejected)만. ACTIVE 판매자 행 + 자기 라인의 클레임만 */
interface DecideClaimUseCase {
    fun approve(userId: String, claimId: Long): ClaimView
    fun reject(userId: String, claimId: Long, reason: String): ClaimView
}

interface GetClaimsUseCase {
    /** 구매자 — 주문의 클레임(요청 순) */
    fun forOrder(userId: String, orderId: Long): List<ClaimView>

    /** 판매자 — 내 라인의 클레임(최신순) */
    fun forSeller(userId: String): List<ClaimView>
}

/** 환불 미리보기 — 서버가 클레임과 같은 계산으로 낸다(FE 는 금액을 계산하지 않는다) */
interface PreviewClaimUseCase {
    fun preview(userId: String, orderId: Long, lineNos: List<Int>?): ClaimPreview
}

/** 클레임이 기다리는 답 (키 = orderId). 주문 안에서 답을 기다리는 클레임은 하나뿐이라 그 클레임이 받는다 */
interface HandleClaimEventUseCase {
    fun onFulfillmentCreated(orderId: Long)
    fun onFulfillmentCancelled(orderId: Long)
    fun onFulfillmentCancelRejected(orderId: Long)
    fun onInventoryRestocked(orderId: Long, restockKey: String?)
    fun onPromotionRestored(orderId: Long)
    fun onPaymentRefunded(orderId: Long)

    /** 재입고·원복의 업무 실패 답 — 단계는 그대로 두고 기한 재발행 · 한도 초과 운영 이슈에 맡긴다 */
    fun onStepFailed(orderId: Long, what: String, reason: String?)
}

interface ProcessClaimDeadlineUseCase {
    fun dueOrderIds(limit: Int): List<Long>
    fun onDeadline(orderId: Long)
}

/** 운영자 재개(CLAIM_STUCK 재시도) — 멈춘 단계의 명령을 다시 내고 기한 점검에 돌려보낸다. 멈추지 않은 클레임이면 아무것도 하지 않는다 */
interface ResumeClaimUseCase {
    fun resume(claimId: Long)
}

data class ClaimView(
    val claimId: Long,
    val orderId: Long,
    val sellerId: Long,
    val lineNos: List<Int>,
    val status: String,
    val step: String,
    val goodsShipped: Boolean,
    val refundAmount: Long?,
    val pointRestore: Long?,
    val shippingRefund: Long?,
    val fullCancel: Boolean?,
    val rejectReason: String?,
    val stuck: Boolean,
    val requestedAt: Instant,
) {
    companion object {
        fun of(c: Claim) = ClaimView(
            claimId = requireNotNull(c.id), orderId = c.orderId, sellerId = c.sellerId, lineNos = c.lineNos,
            status = c.status.name, step = c.step.name, goodsShipped = c.goodsShipped, refundAmount = c.pgRefund,
            pointRestore = c.pointRestore, shippingRefund = c.shippingRefund, fullCancel = c.fullCancel,
            rejectReason = c.rejectReason, stuck = c.stuck, requestedAt = c.requestedAt,
        )
    }
}

/**
 * 미리보기. 출고된 라인(출고 표시가 있는 것)은 판매자 승인이 필요하고 그 판매자 배송비는 돌려주지 않는다고 본다 —
 * 실제 판정은 이행 도메인의 답이 한다.
 */
data class ClaimPreview(
    val orderId: Long,
    val lines: List<Line>,
    val pointRestore: Long,
    val shippingRefund: Long,
    val refundAmount: Long,
    val fullCancel: Boolean,
    val couponReturn: Boolean,
    val needsSellerApproval: Boolean,
) {
    data class Line(val lineNo: Int, val productName: String, val sellerId: Long, val payable: Long, val pointAmount: Long, val shipped: Boolean)
}
