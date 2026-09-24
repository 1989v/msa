package com.kgd.order.domain.cart.model

/** 장바구니 한 줄 — 회원·상품·수량. 가격은 담지 않는다(주문서가 읽기 모델에서 정한다). 판매자 혼합 가능 */
data class CartItem(
    val memberId: String,
    val productId: Long,
    val quantity: Int,
) {
    init {
        require(memberId.isNotBlank()) { "회원 id 가 비었다" }
        require(quantity in 1..MAX_QUANTITY) { "수량은 1~$MAX_QUANTITY 입니다" }
    }

    companion object {
        const val MAX_QUANTITY = 999
    }
}
