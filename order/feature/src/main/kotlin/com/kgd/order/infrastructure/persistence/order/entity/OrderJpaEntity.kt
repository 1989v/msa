package com.kgd.order.infrastructure.persistence.order.entity

import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderFailureReason
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.sheet.model.ShippingLine
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.time.Instant
import java.time.LocalDateTime

/**
 * 주문. 금액 합계 컬럼은 라인에서 유도되는 값을 저장한 것이다(조회용). 옛 흐름 주문은 새 컬럼이 비어 있다(확장 단계라 NULL 허용).
 * `@Version` — 같은 주문을 두 트랜잭션이 동시에 바꾸면 늦은 쪽이 충돌로 되돌아간다.
 */
@Entity
@Table(name = "orders")
class OrderJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, length = 100)
    val userId: String,
    status: OrderStatus,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @OneToMany(mappedBy = "order", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    val items: MutableList<OrderItemJpaEntity> = mutableListOf(),
    @Column(name = "order_sheet_id")
    val orderSheetId: Long? = null,
    @Column(name = "user_coupon_id")
    val userCouponId: Long? = null,
    @Column(name = "items_amount") val itemsAmount: Long? = null,
    @Column(name = "coupon_discount") val couponDiscount: Long? = null,
    @Column(name = "point_amount") val pointAmount: Long? = null,
    @Column(name = "shipping_amount") val shippingAmount: Long? = null,
    @Column(name = "payable_amount") val payableAmount: Long? = null,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: OrderStatus = status
        private set

    @Enumerated(EnumType.STRING)
    @Column(name = "failure_reason", length = 40)
    var failureReason: OrderFailureReason? = null
        private set

    @Column(name = "refunded_amount", nullable = false)
    var refundedAmount: Long = 0
        private set

    @Version
    @Column(nullable = false)
    var version: Long = 0
        private set

    @Column(name = "updated_at")
    var updatedAt: Instant? = null
        private set

    /** 판매자별 배송비 라인 — 만든 뒤 바뀌지 않는다 */
    @OneToMany(mappedBy = "order", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("id ASC")
    val shippingLines: MutableList<OrderShippingJpaEntity> = mutableListOf()

    /** 바뀌는 것만 옮긴다 — 상태 · 실패 사유 · 환불 누계 · 라인 상태. 금액 스냅샷은 그대로 */
    fun apply(order: Order, now: Instant) {
        val before = listOf(status, failureReason, refundedAmount) + items.map { it.status }
        status = order.status
        failureReason = order.failureReason
        refundedAmount = order.refundedAmount
        order.items.forEach { line -> items.first { it.id == line.id }.changeStatus(line.status) }
        // 바뀐 것이 없으면 행을 건드리지 않는다(버전도 그대로)
        if (listOf(status, failureReason, refundedAmount) + items.map { it.status } != before) updatedAt = now
    }

    fun toDomain(): Order = Order.restore(
        id = id,
        userId = userId,
        orderSheetId = orderSheetId,
        userCouponId = userCouponId,
        items = items.sortedBy { it.lineNo ?: 0 }.mapIndexed { index, item -> item.toDomain(index + 1) },
        shippingLines = shippingLines.map { ShippingLine(it.sellerId, it.fee) },
        status = status,
        failureReason = failureReason,
        refundedAmount = refundedAmount,
        createdAt = createdAt,
        version = version,
    )

    companion object {
        fun fromDomain(order: Order, now: Instant): OrderJpaEntity {
            val entity = OrderJpaEntity(
                id = order.id,
                userId = order.userId,
                status = order.status,
                createdAt = order.createdAt,
                orderSheetId = order.orderSheetId,
                userCouponId = order.userCouponId,
                itemsAmount = order.itemsAmount,
                couponDiscount = order.couponDiscount,
                pointAmount = order.pointAmount,
                shippingAmount = order.shippingAmount,
                payableAmount = order.payableAmount,
            )
            entity.failureReason = order.failureReason
            entity.refundedAmount = order.refundedAmount
            entity.updatedAt = now
            entity.items.addAll(order.items.map { OrderItemJpaEntity.fromDomain(it).also { e -> e.assignOrder(entity) } })
            entity.shippingLines.addAll(order.shippingLines.map { OrderShippingJpaEntity(order = entity, sellerId = it.sellerId, fee = it.fee) })
            return entity
        }
    }
}

@Entity
@Table(name = "order_shipping")
class OrderShippingJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    val order: OrderJpaEntity,
    @Column(name = "seller_id", nullable = false) val sellerId: Long,
    @Column(nullable = false) val fee: Long,
)

/** 주문 상태 이력 — 추가만 한다. 옛 상태값(PENDING 등)도 담겨 있어 문자열로 둔다 */
@Entity
@Table(name = "order_status_history")
class OrderStatusHistoryJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "order_id", nullable = false) val orderId: Long,
    @Column(name = "from_status", length = 20) val fromStatus: String?,
    @Column(name = "to_status", nullable = false, length = 20) val toStatus: String,
    @Column(length = 100) val reason: String?,
    @Column(nullable = false, length = 100) val actor: String,
    @Column(name = "occurred_at", nullable = false) val occurredAt: Instant,
)
