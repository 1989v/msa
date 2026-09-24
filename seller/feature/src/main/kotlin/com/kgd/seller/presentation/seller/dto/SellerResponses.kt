package com.kgd.seller.presentation.seller.dto

import com.kgd.seller.application.seller.usecase.GetMySellerApplicationUseCase
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

/** 내 입점 신청 — [SellerResponse] 에 정지 사유를 더한 것. 정지 사유는 지금 정지 상태일 때만 채운다 */
data class MySellerApplicationResponse(
    val id: Long,
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
    val suspendReason: String?,
    val appliedAt: Instant,
    val updatedAt: Instant,
) {
    companion object {
        fun from(a: GetMySellerApplicationUseCase.MySellerApplication) = MySellerApplicationResponse(
            id = a.seller.id,
            status = a.seller.status.name,
            businessName = a.seller.businessName,
            businessRegistrationNo = a.seller.businessRegistrationNo,
            representativeName = a.seller.representativeName,
            bankName = a.seller.bankName,
            accountMasked = a.seller.accountMasked,
            shippingFee = a.seller.shippingFee,
            settlementCycle = a.seller.settlementCycle.name,
            commissionRateBp = a.seller.commissionRateBp,
            rejectReason = a.seller.rejectReason,
            suspendReason = a.suspendReason,
            appliedAt = a.seller.appliedAt,
            updatedAt = a.seller.updatedAt,
        )
    }
}
