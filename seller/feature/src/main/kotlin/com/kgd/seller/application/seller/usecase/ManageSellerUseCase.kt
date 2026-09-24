package com.kgd.seller.application.seller.usecase

/**
 * 어드민 조치 — 승인·반려·정지·재활성·수수료율 변경. 모든 조치는 행위자·사유를 `seller_admin_action` 에 남긴다.
 * 반려·정지·수수료율 변경은 사유가 필수다.
 */
interface ManageSellerUseCase {
    fun approve(command: Approve): SellerView
    fun reject(command: Reject): SellerView
    fun suspend(command: Suspend): SellerView
    fun reactivate(command: Reactivate): SellerView
    fun changeCommission(command: ChangeCommission): SellerView

    data class Approve(val sellerId: Long, val actorId: String, val commissionRateBp: Int, val reason: String?)
    data class Reject(val sellerId: Long, val actorId: String, val reason: String)
    data class Suspend(val sellerId: Long, val actorId: String, val reason: String)
    data class Reactivate(val sellerId: Long, val actorId: String, val reason: String?)
    data class ChangeCommission(val sellerId: Long, val actorId: String, val commissionRateBp: Int, val reason: String)
}
