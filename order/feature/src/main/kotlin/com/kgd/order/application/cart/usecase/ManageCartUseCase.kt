package com.kgd.order.application.cart.usecase

/** 장바구니 — 로그인 회원 본인 것만. 가격은 보여주기용으로 읽기 모델에서 붙이고, 주문서가 다시 계산한다 */
interface ManageCartUseCase {
    fun get(memberId: String): CartView
    fun put(memberId: String, productId: Long, quantity: Int): CartView
    fun remove(memberId: String, productId: Long): CartView
    fun clear(memberId: String)
}

data class CartView(val items: List<CartLineView>)

/** [onSale] 이 false 면 주문서가 422 로 거부한다(판매 중지·판매자 정지) */
data class CartLineView(
    val productId: Long,
    val quantity: Int,
    val productName: String?,
    val price: Long?,
    val sellerId: Long?,
    val onSale: Boolean,
)
