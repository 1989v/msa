package com.kgd.product.domain.seller.model

import java.time.Instant

/**
 * product 가 보는 판매자 — seller 도메인 이벤트(seller.seller.*)로 채우는 읽기 모델.
 * 상품 쓰기 권한은 토큰 역할이 아니라 이 행의 ACTIVE 로 판정한다(정지가 토큰 만료를 기다리지 않는다).
 */
class ProductSeller(
    val sellerId: Long,
    val memberId: String,
    val status: ProductSellerStatus,
    /** 원천 판매자 행의 변경 시각 — 늦게 도착한 옛 이벤트를 거르는 기준 */
    val occurredAt: Instant,
) {
    val isActive: Boolean get() = status == ProductSellerStatus.ACTIVE

    /** 아웃박스 재시도는 순서를 뒤집을 수 있다 — 지금 행보다 오래된 이벤트는 반영하지 않는다 */
    fun isSupersededBy(incoming: ProductSeller): Boolean = !incoming.occurredAt.isBefore(occurredAt)
}

/** seller 도메인의 SellerStatus 와 같은 값 — 이벤트 문자열을 그대로 받는다 */
enum class ProductSellerStatus { PENDING, ACTIVE, REJECTED, SUSPENDED }
