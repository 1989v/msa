package com.kgd.seller.application.seller.usecase

/**
 * 회원 본인의 가장 최근 입점 신청 — 상태를 가리지 않는다.
 * 판매자 포털([GetMySellerUseCase])은 ACTIVE 만 통과시키므로, 심사 중·반려·정지 회원이 자기 상태와
 * 사유를 보는 길은 이것뿐이다. 신청 행이 없으면 NotFound.
 */
interface GetMySellerApplicationUseCase {
    fun execute(memberId: String): MySellerApplication

    /** [suspendReason] 은 지금 정지 상태일 때만 — 가장 최근 정지 조치의 사유 */
    data class MySellerApplication(val seller: SellerView, val suspendReason: String?)
}
