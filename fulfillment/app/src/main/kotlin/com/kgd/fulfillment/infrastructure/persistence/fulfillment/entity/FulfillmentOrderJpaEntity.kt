package com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity

import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime

@Entity
@Table(name = "fulfillment_order")
class FulfillmentOrderJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false)
    val orderId: Long,
    @Column(nullable = false)
    val warehouseId: Long,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: FulfillmentStatus,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDomain(): FulfillmentOrder = FulfillmentOrder.restore(
        id = id,
        orderId = orderId,
        warehouseId = warehouseId,
        status = status,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(fo: FulfillmentOrder): FulfillmentOrderJpaEntity = FulfillmentOrderJpaEntity(
            id = fo.id,
            orderId = fo.orderId,
            warehouseId = fo.warehouseId,
            status = fo.getStatus(),
            createdAt = fo.createdAt
        )
    }
}
