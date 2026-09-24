package com.kgd.order.infrastructure.persistence.cart.entity

import com.kgd.order.domain.cart.model.CartItem
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "cart_item")
class CartItemJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false, length = 64)
    val memberId: String,
    @Column(name = "product_id", nullable = false)
    val productId: Long,
    quantity: Int,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant,
    updatedAt: Instant,
) {
    @Column(nullable = false)
    var quantity: Int = quantity
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = updatedAt
        private set

    fun changeQuantity(quantity: Int, now: Instant) {
        this.quantity = quantity
        updatedAt = now
    }

    fun toDomain() = CartItem(memberId, productId, quantity)
}
