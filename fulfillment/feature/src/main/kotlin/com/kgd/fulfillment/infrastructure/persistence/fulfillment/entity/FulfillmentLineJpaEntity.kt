package com.kgd.fulfillment.infrastructure.persistence.fulfillment.entity

import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentLine
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentLineStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/** 이행 라인 — 루트(fulfillment_order)는 id 로만 가리킨다. 저장·조회는 어댑터가 루트와 함께 한다 */
@Entity
@Table(
    name = "fulfillment_line",
    uniqueConstraints = [UniqueConstraint(name = "uk_fulfillment_line_item", columnNames = ["fulfillment_id", "order_item_id"])],
)
class FulfillmentLineJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false)
    val fulfillmentId: Long,
    /** 주문 라인 id — 이 식별이 생기기 전 행은 null */
    @Column
    val orderItemId: Long? = null,
    @Column(nullable = false)
    val productId: Long,
    @Column(nullable = false)
    val quantity: Int,
    status: FulfillmentLineStatus,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: FulfillmentLineStatus = status
        private set

    fun toDomain(): FulfillmentLine = FulfillmentLine.restore(id, orderItemId, productId, quantity, status)

    companion object {
        fun fromDomain(fulfillmentId: Long, line: FulfillmentLine) = FulfillmentLineJpaEntity(
            id = line.id,
            fulfillmentId = fulfillmentId,
            orderItemId = line.orderItemId,
            productId = line.productId,
            quantity = line.quantity,
            status = line.getStatus(),
        )
    }
}
