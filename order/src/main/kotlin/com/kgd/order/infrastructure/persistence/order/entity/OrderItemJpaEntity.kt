package com.kgd.order.infrastructure.persistence.order.entity

import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.OrderItem
import jakarta.persistence.*
import java.math.BigDecimal

@Entity
@Table(name = "order_items")
class OrderItemJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false)
    val productId: Long,
    @Column(nullable = false)
    val quantity: Int,
    @Column(nullable = false, precision = 19, scale = 2)
    val unitPrice: BigDecimal,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    var order: OrderJpaEntity? = null
) {
    fun toDomain(): OrderItem = OrderItem.restore(id, productId, quantity, Money(unitPrice))

    companion object {
        fun fromDomain(item: OrderItem): OrderItemJpaEntity = OrderItemJpaEntity(
            id = item.id,
            productId = item.productId,
            quantity = item.quantity,
            unitPrice = item.unitPrice.amount
        )
    }
}
