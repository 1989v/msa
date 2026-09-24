package com.kgd.order.application.cart.port

import com.kgd.order.domain.cart.model.CartItem

interface CartRepositoryPort {
    fun findAllByMemberId(memberId: String): List<CartItem>

    /** 같은 (회원, 상품) 줄이 있으면 수량을 바꾸고 없으면 만든다 */
    fun save(item: CartItem)
    fun delete(memberId: String, productId: Long)
    fun deleteAll(memberId: String)
}
