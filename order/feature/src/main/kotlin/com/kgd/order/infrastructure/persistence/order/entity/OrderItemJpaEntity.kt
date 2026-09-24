package com.kgd.order.infrastructure.persistence.order.entity

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.OrderLineStatus
import jakarta.persistence.*
import java.math.BigDecimal

/**
 * 주문 라인 — 주문서 라인 스냅샷. 옛 흐름 라인은 스냅샷 컬럼이 비어 있어 읽을 때 기본값(플랫폼 판매자 1, 할인 0)을 쓴다.
 */
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
    order: OrderJpaEntity? = null,
    @Column(name = "line_no") val lineNo: Int? = null,
    @Column(name = "product_name", length = 255) val productName: String? = null,
    @Column(name = "seller_id") val sellerId: Long? = null,
    @Column(name = "coupon_discount") val couponDiscount: Long? = null,
    @Enumerated(EnumType.STRING) @Column(name = "coupon_bearer", length = 10) val couponBearer: CouponBearer? = null,
    @Column(name = "point_amount") val pointAmount: Long? = null,
    @Column(name = "commission_rate_bp") val commissionRateBp: Int? = null,
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

    fun assignOrder(order: OrderJpaEntity) {
        this.order = order
    }

    fun changeStatus(status: OrderLineStatus) {
        this.status = status
    }

    fun toDomain(fallbackLineNo: Int): OrderItem = OrderItem.restore(
        id = id,
        lineNo = lineNo ?: fallbackLineNo,
        productId = productId,
        productName = productName.orEmpty(),
        sellerId = sellerId ?: PLATFORM_SELLER_ID,
        unitPrice = Money(requireNotNull(unitPriceWon) { "unit_price_won 백필 누락: order_items.id=$id" }),
        quantity = quantity,
        couponDiscount = couponDiscount ?: 0L,
        couponBearer = couponBearer,
        pointAmount = pointAmount ?: 0L,
        commissionRateBp = commissionRateBp ?: 0,
        status = status,
    )

    companion object {
        /** 옛 흐름 라인의 판매자 — 기존 상품은 플랫폼 기본 판매자로 백필됐다 */
        private const val PLATFORM_SELLER_ID = 1L

        fun fromDomain(item: OrderItem): OrderItemJpaEntity = OrderItemJpaEntity(
            id = item.id,
            productId = item.productId,
            quantity = item.quantity,
            unitPrice = BigDecimal.valueOf(item.unitPrice.amount),
            unitPriceWon = item.unitPrice.amount,
            lineNo = item.lineNo,
            productName = item.productName,
            sellerId = item.sellerId,
            couponDiscount = item.couponDiscount,
            couponBearer = item.couponBearer,
            pointAmount = item.pointAmount,
            commissionRateBp = item.commissionRateBp,
            status = item.status,
        )
    }
}
