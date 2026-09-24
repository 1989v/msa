package com.kgd.order.infrastructure.persistence.cart.adapter

import com.kgd.order.application.cart.port.CartRepositoryPort
import com.kgd.order.domain.cart.model.CartItem
import com.kgd.order.infrastructure.persistence.cart.entity.CartItemJpaEntity
import com.kgd.order.infrastructure.persistence.cart.repository.CartItemJpaRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import java.time.Clock

@Component
class CartRepositoryAdapter(
    private val jpa: CartItemJpaRepository,
    @Qualifier("orderClock") private val clock: Clock,
) : CartRepositoryPort {

    override fun findAllByMemberId(memberId: String): List<CartItem> =
        jpa.findAllByMemberIdOrderById(memberId).map { it.toDomain() }

    override fun save(item: CartItem) {
        val now = clock.instant()
        jpa.findByMemberIdAndProductId(item.memberId, item.productId)?.changeQuantity(item.quantity, now)
            ?: jpa.save(CartItemJpaEntity(memberId = item.memberId, productId = item.productId, quantity = item.quantity, createdAt = now, updatedAt = now))
    }

    override fun delete(memberId: String, productId: Long) = jpa.deleteByMemberIdAndProductId(memberId, productId)

    override fun deleteAll(memberId: String) = jpa.deleteAllByMemberId(memberId)
}
