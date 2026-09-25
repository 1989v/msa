package com.kgd.fulfillment.domain.ownership.model

import java.time.Instant

/**
 * 이행 REST 소유 판정용 읽기 모델 — "이 상품은 어느 판매자 것인가". `product.item.*` 이벤트로 채운다.
 * 소유 판매자는 상품 등록 때 정해지고 바뀌지 않지만, 재발행·순서 역전을 같은 규칙으로 거르려고 시각을 둔다.
 */
class ProductOwner(
    val productId: Long,
    val sellerId: Long,
    val occurredAt: Instant,
) {
    /** 아웃박스 재시도는 순서를 뒤집을 수 있다 — 지금 행보다 오래된 이벤트는 반영하지 않는다 */
    fun isSupersededBy(incoming: ProductOwner): Boolean = !incoming.occurredAt.isBefore(occurredAt)
}

/**
 * 이행 REST 소유 판정용 판매자 — "이 회원은 어느 판매자이고 지금 ACTIVE 인가". `seller.seller.*` 이벤트로 채운다.
 * 행을 매 요청 읽으므로 정지는 토큰 만료를 기다리지 않고 바로 막힌다.
 */
class OwnerSeller(
    val sellerId: Long,
    val memberId: String,
    val status: OwnerSellerStatus,
    val occurredAt: Instant,
) {
    val isActive: Boolean get() = status == OwnerSellerStatus.ACTIVE

    fun isSupersededBy(incoming: OwnerSeller): Boolean = !incoming.occurredAt.isBefore(occurredAt)
}

/** seller 도메인의 SellerStatus 와 같은 값 — 이벤트 문자열을 그대로 받는다 */
enum class OwnerSellerStatus { PENDING, ACTIVE, REJECTED, SUSPENDED }
