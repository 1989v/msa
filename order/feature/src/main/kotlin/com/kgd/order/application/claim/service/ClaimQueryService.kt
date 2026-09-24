package com.kgd.order.application.claim.service

import com.kgd.common.exception.ForbiddenException
import com.kgd.order.application.claim.port.ClaimRepositoryPort
import com.kgd.order.application.claim.usecase.ClaimPreview
import com.kgd.order.application.claim.usecase.ClaimView
import com.kgd.order.application.claim.usecase.GetClaimsUseCase
import com.kgd.order.application.claim.usecase.PreviewClaimUseCase
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.readmodel.port.SellerViewRepositoryPort
import com.kgd.order.domain.claim.model.ClaimRefundPlan
import com.kgd.order.domain.claim.model.ClaimStatus
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.OrderLineStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 클레임 조회 · 환불 미리보기. 미리보기는 클레임 처리와 같은 [ClaimRefundPlan] 으로 계산한다 */
@Service
class ClaimQueryService(
    private val orders: OrderRepositoryPort,
    private val claims: ClaimRepositoryPort,
    private val sellers: SellerViewRepositoryPort,
) : GetClaimsUseCase, PreviewClaimUseCase {

    @Transactional("orderTransactionManager", readOnly = true)
    override fun forOrder(userId: String, orderId: Long): List<ClaimView> {
        orders.findById(orderId)?.takeIf { it.userId == userId } ?: throw OrderNotFoundException(orderId)
        return claims.findAllByOrderId(orderId).map(ClaimView::of)
    }

    @Transactional("orderTransactionManager", readOnly = true)
    override fun forSeller(userId: String): List<ClaimView> {
        val seller = sellers.findActiveByMemberId(userId) ?: throw ForbiddenException("ACTIVE 판매자만 클레임을 볼 수 있습니다")
        return claims.findAllBySellerId(seller.sellerId, SELLER_LIST_LIMIT).map(ClaimView::of)
    }

    @Transactional("orderTransactionManager", readOnly = true)
    override fun preview(userId: String, orderId: Long, lineNos: List<Int>?): ClaimPreview {
        val order = orders.findById(orderId)?.takeIf { it.userId == userId } ?: throw OrderNotFoundException(orderId)
        val existing = claims.findAllByOrderId(orderId)
        val inClaim = existing.filter { it.status.open }.flatMap { it.lineNos }.toSet()
        val targets = lineNos?.distinct() ?: order.items.filter { it.status == OrderLineStatus.ACTIVE && it.lineNo !in inClaim }.map { it.lineNo }
        val shippedNow = order.items.filter { it.lineNo in targets && it.shippedAt != null }.map { it.sellerId }.toSet()
        val shippedBefore = existing.filter { it.status == ClaimStatus.REFUNDED && it.goodsShipped }.map { it.sellerId }.toSet()
        val plan = ClaimRefundPlan.of(order, targets, shippedNow + shippedBefore)
        return ClaimPreview(
            orderId = orderId,
            lines = plan.lines.map {
                ClaimPreview.Line(it.lineNo, it.productName, it.sellerId, it.payable, it.pointAmount, it.shippedAt != null)
            },
            pointRestore = plan.pointRestore,
            shippingRefund = plan.shippingRefund,
            refundAmount = plan.pgRefund,
            fullCancel = plan.fullCancel,
            couponReturn = plan.couponReturn,
            needsSellerApproval = shippedNow.isNotEmpty(),
        )
    }

    private companion object {
        const val SELLER_LIST_LIMIT = 100
    }
}
