package com.kgd.order.infrastructure.persistence.order.entity

import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime

@Entity
@Table(name = "orders")
class OrderJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, length = 100)
    val userId: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: OrderStatus,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @OneToMany(mappedBy = "order", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    val items: MutableList<OrderItemJpaEntity> = mutableListOf()
) {
    fun toDomain(): Order = Order.restore(
        id = id,
        userId = userId,
        items = items.map { it.toDomain() },
        status = status,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(order: Order): OrderJpaEntity {
            val entity = OrderJpaEntity(
                id = order.id,
                userId = order.userId,
                status = order.status,
                createdAt = order.createdAt
            )
            val itemEntities = order.items.map { item ->
                OrderItemJpaEntity.fromDomain(item).also { it.order = entity }
            }
            entity.items.addAll(itemEntities)
            return entity
        }
    }
}
