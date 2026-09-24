package com.kgd.order.presentation.claim.dto

import com.kgd.order.application.claim.usecase.ClaimPreview
import com.kgd.order.application.claim.usecase.ClaimView
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant

/** 취소 요청 — [lineNos] 가 없으면 전체 취소(취소할 수 있는 라인 전부) */
data class ClaimRequest(val orderId: Long, val lineNos: List<Int>? = null)

data class ClaimRejectRequest(@field:NotBlank @field:Size(max = 500) val reason: String)

/**
 * 클레임 — [status] REQUESTED·APPROVED 는 진행 중, REFUNDED·REJECTED 는 끝. [step] SELLER_DECISION 은 이미 출고돼
 * 판매자 결정을 기다리는 중. 금액은 승인 뒤 환불 단계에 들어가면 채워진다.
 */
data class ClaimResponse(
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
        fun from(v: ClaimView) = ClaimResponse(
            v.claimId, v.orderId, v.sellerId, v.lineNos, v.status, v.step, v.goodsShipped, v.refundAmount, v.pointRestore,
            v.shippingRefund, v.fullCancel, v.rejectReason, v.stuck, v.requestedAt,
        )
    }
}

/** 환불 미리보기 — [refundAmount] 는 결제 수단으로, [pointRestore] 는 포인트로 돌아간다 */
data class ClaimPreviewResponse(
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

    companion object {
        fun from(p: ClaimPreview) = ClaimPreviewResponse(
            p.orderId,
            p.lines.map { Line(it.lineNo, it.productName, it.sellerId, it.payable, it.pointAmount, it.shipped) },
            p.pointRestore, p.shippingRefund, p.refundAmount, p.fullCancel, p.couponReturn, p.needsSellerApproval,
        )
    }
}
