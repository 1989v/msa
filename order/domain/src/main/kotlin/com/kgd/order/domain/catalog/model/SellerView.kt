package com.kgd.order.domain.catalog.model

import java.time.Instant

/**
 * order 가 보는 판매자 — `seller.seller.*` 로 채우는 읽기 모델. 판매 가능 판정·수수료율·배송비를 준다.
 * 플랫폼 기본 판매자(id 1)는 seller 시드라 이벤트가 없어 마이그레이션이 시드한다.
 */
data class SellerView(
    val sellerId: Long,
    val status: String,
    /** 승인 전(PENDING)에는 없다 */
    val commissionRateBp: Int?,
    /** 판매자별 고정 배송비(원) — 주문 안에서 판매자마다 한 번 */
    val shippingFee: Long,
    val occurredAt: Instant,
    /** 판매자 회원 id — 판매자 포털 권한(X-User-Id 대조). 옛 이벤트로 채운 행은 비어 있다 */
    val memberId: String? = null,
    /** 상호 — 구매 화면 표시용. seller 가 승인된 판매자에게만 싣는다(심사 중·옛 이벤트는 비어 있다) */
    val businessName: String? = null,
) {
    init {
        require(shippingFee >= 0) { "배송비는 음수일 수 없다" }
    }

    /** ACTIVE 이고 수수료율이 정해진 판매자만 판다 — 정지되면 새 주문서가 막힌다(진행 중 주문은 영향 없음) */
    val isSellable: Boolean get() = status == ACTIVE && commissionRateBp != null

    fun isSupersededBy(incoming: SellerView): Boolean = !incoming.occurredAt.isBefore(occurredAt)

    companion object {
        const val ACTIVE = "ACTIVE"
    }
}
