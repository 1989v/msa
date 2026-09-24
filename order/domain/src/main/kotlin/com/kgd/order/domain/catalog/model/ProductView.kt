package com.kgd.order.domain.catalog.model

import java.time.Instant

/**
 * order 가 보는 상품 — `product.item.{created,updated}` 로 채우는 읽기 모델. 주문서 가격은 여기서만 온다.
 * 상태는 product 의 문자열을 그대로 받는다(product 가 상태를 늘려도 이 모델이 깨지지 않게).
 */
data class ProductView(
    val productId: Long,
    val name: String,
    /** 판매가(원) */
    val price: Long,
    val status: String,
    val sellerId: Long,
    /** 원천 이벤트 시각 — 늦게 도착한 옛 이벤트를 거르는 기준 */
    val occurredAt: Instant,
) {
    init {
        require(price >= 0) { "가격은 음수일 수 없다" }
    }

    val isOnSale: Boolean get() = status == ON_SALE

    fun isSupersededBy(incoming: ProductView): Boolean = !incoming.occurredAt.isBefore(occurredAt)

    companion object {
        const val ON_SALE = "ACTIVE"
    }
}
