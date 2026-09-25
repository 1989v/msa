package com.kgd.order.infrastructure.persistence.order.entity

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.OrderLineStatus
import jakarta.persistence.*
import java.time.Instant

/** 주문 라인 — 주문서 라인 스냅샷 */
@Entity
@Table(name = "order_items")
class OrderItemJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false)
    val productId: Long,
    @Column(nullable = false)
    val quantity: Int,
    /** 원 단위 단가 */
    @Column(name = "unit_price_won", nullable = false)
    val unitPriceWon: Long,
    order: OrderJpaEntity? = null,
    @Column(name = "line_no", nullable = false) val lineNo: Int,
    @Column(name = "product_name", nullable = false, length = 255) val productName: String,
    @Column(name = "seller_id", nullable = false) val sellerId: Long,
    @Column(name = "coupon_discount", nullable = false) val couponDiscount: Long,
    @Enumerated(EnumType.STRING) @Column(name = "coupon_bearer", length = 10) val couponBearer: CouponBearer? = null,
    @Column(name = "point_amount", nullable = false) val pointAmount: Long,
    @Column(name = "commission_rate_bp", nullable = false) val commissionRateBp: Int,
    status: OrderLineStatus = OrderLineStatus.ACTIVE,
) {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    var order: OrderJpaEntity? = order
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: OrderLineStatus = status
        private set

    @Column(name = "shipped_at")
    var shippedAt: Instant? = null
        private set

    @Column(name = "delivered_at")
    var deliveredAt: Instant? = null
        private set

    @Column(name = "purchase_confirmed_at")
    var purchaseConfirmedAt: Instant? = null
        private set

    fun assignOrder(order: OrderJpaEntity) {
        this.order = order
    }

    fun changeStatus(status: OrderLineStatus) {
        this.status = status
    }

    fun changeProgress(item: OrderItem) {
        shippedAt = item.shippedAt
        deliveredAt = item.deliveredAt
        purchaseConfirmedAt = item.purchaseConfirmedAt
    }

    /** 바뀌었는지 비교할 값 — 상태와 진행 표시 */
    fun snapshot(): List<Any?> = listOf(status, shippedAt, deliveredAt, purchaseConfirmedAt)

    fun toDomain(): OrderItem = OrderItem.restore(
        id = id,
        lineNo = lineNo,
        productId = productId,
        productName = productName,
        sellerId = sellerId,
        unitPrice = Money(unitPriceWon),
        quantity = quantity,
        couponDiscount = couponDiscount,
        couponBearer = couponBearer,
        pointAmount = pointAmount,
        commissionRateBp = commissionRateBp,
        status = status,
        shippedAt = shippedAt,
        deliveredAt = deliveredAt,
        purchaseConfirmedAt = purchaseConfirmedAt,
    )

    companion object {
        fun fromDomain(item: OrderItem): OrderItemJpaEntity = OrderItemJpaEntity(
            id = item.id,
            productId = item.productId,
            quantity = item.quantity,
            unitPriceWon = item.unitPrice.amount,
            lineNo = item.lineNo,
            productName = item.productName,
            sellerId = item.sellerId,
            couponDiscount = item.couponDiscount,
            couponBearer = item.couponBearer,
            pointAmount = item.pointAmount,
            commissionRateBp = item.commissionRateBp,
            status = item.status,
        ).also { it.changeProgress(item) }
    }
}
