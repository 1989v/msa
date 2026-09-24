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
    /** 옛 컬럼 — 확장 단계라 롤백한 옛 코드가 읽도록 같은 값을 계속 쓴다. 다음 단계에서 삭제 */
    @Column(nullable = false, precision = 19, scale = 2)
    val unitPrice: BigDecimal,
    /** 원 단위 단가 — 코드가 읽는 컬럼. 확장 단계라 DB 는 NULL 을 허용한다 */
    @Column(name = "unit_price_won")
    val unitPriceWon: Long?,
    order: OrderJpaEntity? = null
) {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    var order: OrderJpaEntity? = order
        private set

    fun assignOrder(order: OrderJpaEntity) {
        this.order = order
    }

    fun toDomain(): OrderItem = OrderItem.restore(
        id, productId, quantity, Money(requireNotNull(unitPriceWon) { "unit_price_won 백필 누락: order_items.id=$id" }),
    )

    companion object {
        fun fromDomain(item: OrderItem): OrderItemJpaEntity = OrderItemJpaEntity(
            id = item.id,
            productId = item.productId,
            quantity = item.quantity,
            unitPrice = BigDecimal.valueOf(item.unitPrice.amount),
            unitPriceWon = item.unitPrice.amount,
        )
    }
}
