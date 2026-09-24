package com.kgd.seller.domain.seller.model

import java.time.Instant

/** 어드민이 판매자에게 한 조치 — 상태·수수료율 변경마다 행위자·사유·시각을 남긴다. 수정·삭제하지 않는다. */
data class SellerAdminAction(
    val sellerId: Long,
    val action: SellerAdminActionType,
    val actorId: String,
    val reason: String?,
    val fromStatus: SellerStatus,
    val toStatus: SellerStatus,
    val commissionRateBp: Int?,
    val createdAt: Instant,
)

enum class SellerAdminActionType { APPROVE, REJECT, SUSPEND, REACTIVATE, CHANGE_COMMISSION }
