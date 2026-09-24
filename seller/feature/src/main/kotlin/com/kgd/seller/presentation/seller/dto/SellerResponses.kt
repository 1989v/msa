package com.kgd.seller.presentation.seller.dto

import com.kgd.seller.application.seller.usecase.QuerySellersUseCase
import com.kgd.seller.application.seller.usecase.SellerView
import java.time.Instant

/** 계좌는 마스킹 값만 — 응답에 암호문·평문이 실리는 경로가 없다 */
data class SellerResponse(
    val id: Long,
    val memberId: String,
    val status: String,
    val businessName: String,
    val businessRegistrationNo: String?,
    val representativeName: String?,
    val bankName: String?,
    val accountMasked: String?,
    val shippingFee: Long,
    val settlementCycle: String,
    val commissionRateBp: Int?,
    val rejectReason: String?,
    val appliedAt: Instant,
    val updatedAt: Instant,
) {
    companion object {
        fun from(v: SellerView) = SellerResponse(
            id = v.id,
            memberId = v.memberId,
            status = v.status.name,
            businessName = v.businessName,
            businessRegistrationNo = v.businessRegistrationNo,
            representativeName = v.representativeName,
            bankName = v.bankName,
            accountMasked = v.accountMasked,
            shippingFee = v.shippingFee,
            settlementCycle = v.settlementCycle.name,
            commissionRateBp = v.commissionRateBp,
            rejectReason = v.rejectReason,
            appliedAt = v.appliedAt,
            updatedAt = v.updatedAt,
        )
    }
}

data class SellerPageResponse(
    val items: List<SellerResponse>,
    val totalElements: Long,
    val page: Int,
    val size: Int,
) {
    companion object {
        fun from(p: QuerySellersUseCase.Page) =
            SellerPageResponse(p.items.map(SellerResponse::from), p.totalElements, p.page, p.size)
    }
}
