package com.kgd.seller.application.seller.usecase

import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.domain.seller.model.SettlementCycle
import java.time.Instant

/** 판매자 조회 결과 — 계좌는 마스킹 표시값만 싣는다(암호문·평문 없음). */
data class SellerView(
    val id: Long,
    val memberId: String,
    val status: SellerStatus,
    val businessName: String,
    val businessRegistrationNo: String?,
    val representativeName: String?,
    val bankName: String?,
    val accountMasked: String?,
    val shippingFee: Long,
    val settlementCycle: SettlementCycle,
    val commissionRateBp: Int?,
    val rejectReason: String?,
    val appliedAt: Instant,
    val updatedAt: Instant,
) {
    companion object {
        fun from(seller: Seller): SellerView = SellerView(
            id = requireNotNull(seller.id),
            memberId = seller.memberId,
            status = seller.status,
            businessName = seller.businessName,
            businessRegistrationNo = seller.businessRegistrationNo,
            representativeName = seller.representativeName,
            bankName = seller.bankName,
            accountMasked = seller.accountMasked,
            shippingFee = seller.shippingFee,
            settlementCycle = seller.settlementCycle,
            commissionRateBp = seller.commissionRateBp,
            rejectReason = seller.rejectReason,
            appliedAt = seller.appliedAt,
            updatedAt = seller.updatedAt,
        )
    }
}
