package com.kgd.order.infrastructure.persistence.cart.repository

import com.kgd.order.infrastructure.persistence.cart.entity.CartItemJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface CartItemJpaRepository : JpaRepository<CartItemJpaEntity, Long> {
    fun findAllByMemberIdOrderById(memberId: String): List<CartItemJpaEntity>
    fun findByMemberIdAndProductId(memberId: String, productId: Long): CartItemJpaEntity?
    fun deleteByMemberIdAndProductId(memberId: String, productId: Long)
    fun deleteAllByMemberId(memberId: String)
}
