package com.kgd.order.infrastructure.persistence.sheet.entity

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetLine
import com.kgd.order.domain.sheet.model.OrderSheetStatus
import com.kgd.order.domain.sheet.model.ShippingLine
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant

/**
 * 주문서. 합계 컬럼은 라인에서 유도되는 값을 저장한 것이다(조회·대조용) — 라인은 만든 뒤 바뀌지 않는다.
 * 바뀌는 것은 사용 표시(status·used_order_id)뿐이고 `@Version` 으로 같은 주문서의 동시 사용을 막는다.
 */
@Entity
@Table(name = "order_sheet")
class OrderSheetJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false, length = 64)
    val memberId: String,
    status: OrderSheetStatus,
    @Column(name = "user_coupon_id")
    val userCouponId: Long?,
    @Column(name = "coupon_definition_id")
    val couponDefinitionId: Long?,
    @Column(name = "items_amount", nullable = false)
    val itemsAmount: Long,
    @Column(name = "coupon_discount", nullable = false)
    val couponDiscount: Long,
    @Column(name = "point_amount", nullable = false)
    val pointAmount: Long,
    @Column(name = "shipping_amount", nullable = false)
    val shippingAmount: Long,
    @Column(name = "payable_amount", nullable = false)
    val payableAmount: Long,
    usedOrderId: Long?,
    @Column(name = "expires_at", nullable = false)
    val expiresAt: Instant,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: OrderSheetStatus = status
        private set

    @Column(name = "used_order_id")
    var usedOrderId: Long? = usedOrderId
        private set

    @Version
    @Column(nullable = false)
    var version: Long = 0
        private set

    @OneToMany(mappedBy = "sheet", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNo ASC")
    val lines: MutableList<OrderSheetLineJpaEntity> = mutableListOf()

    @OneToMany(mappedBy = "sheet", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("id ASC")
    val shippingLines: MutableList<OrderSheetShippingJpaEntity> = mutableListOf()

    /** 사용 표시만 옮긴다 — 금액·라인은 스냅샷이라 고치지 않는다 */
    fun applyUsage(sheet: OrderSheet) {
        status = sheet.status
        usedOrderId = sheet.usedOrderId
    }

    fun toDomain(): OrderSheet = OrderSheet.restore(
        id = requireNotNull(id),
        memberId = memberId,
        lines = lines.map { it.toDomain() },
        shippingLines = shippingLines.map { ShippingLine(it.sellerId, it.fee) },
        userCouponId = userCouponId,
        couponDefinitionId = couponDefinitionId,
        status = status,
        usedOrderId = usedOrderId,
        expiresAt = expiresAt,
        createdAt = createdAt,
    )

    companion object {
        fun from(sheet: OrderSheet): OrderSheetJpaEntity {
            val entity = OrderSheetJpaEntity(
                memberId = sheet.memberId,
                status = sheet.status,
                userCouponId = sheet.userCouponId,
                couponDefinitionId = sheet.couponDefinitionId,
                itemsAmount = sheet.itemsAmount,
                couponDiscount = sheet.couponDiscount,
                pointAmount = sheet.pointAmount,
                shippingAmount = sheet.shippingAmount,
                payableAmount = sheet.payableAmount,
                usedOrderId = sheet.usedOrderId,
                expiresAt = sheet.expiresAt,
                createdAt = sheet.createdAt,
            )
            entity.lines += sheet.lines.map { OrderSheetLineJpaEntity.from(it, entity) }
            entity.shippingLines += sheet.shippingLines.map { OrderSheetShippingJpaEntity(sheet = entity, sellerId = it.sellerId, fee = it.fee) }
            return entity
        }
    }
}

@Entity
@Table(name = "order_sheet_line")
class OrderSheetLineJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_sheet_id", nullable = false)
    val sheet: OrderSheetJpaEntity,
    @Column(name = "line_no", nullable = false) val lineNo: Int,
    @Column(name = "product_id", nullable = false) val productId: Long,
    @Column(name = "product_name", nullable = false, length = 255) val productName: String,
    @Column(name = "seller_id", nullable = false) val sellerId: Long,
    @Column(name = "unit_price", nullable = false) val unitPrice: Long,
    @Column(nullable = false) val quantity: Int,
    @Column(name = "coupon_discount", nullable = false) val couponDiscount: Long,
    @Enumerated(EnumType.STRING) @Column(name = "coupon_bearer", length = 10) val couponBearer: CouponBearer?,
    @Column(name = "point_amount", nullable = false) val pointAmount: Long,
    @Column(name = "commission_rate_bp", nullable = false) val commissionRateBp: Int,
    @Column(name = "payable_amount", nullable = false) val payableAmount: Long,
) {
    fun toDomain() = OrderSheetLine(
        lineNo, productId, productName, sellerId, unitPrice, quantity, couponDiscount, couponBearer, pointAmount, commissionRateBp,
    )

    companion object {
        fun from(line: OrderSheetLine, sheet: OrderSheetJpaEntity) = OrderSheetLineJpaEntity(
            sheet = sheet,
            lineNo = line.lineNo,
            productId = line.productId,
            productName = line.productName,
            sellerId = line.sellerId,
            unitPrice = line.unitPrice,
            quantity = line.quantity,
            couponDiscount = line.couponDiscount,
            couponBearer = line.couponBearer,
            pointAmount = line.pointAmount,
            commissionRateBp = line.commissionRateBp,
            payableAmount = line.payable,
        )
    }
}

@Entity
@Table(name = "order_sheet_shipping")
class OrderSheetShippingJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_sheet_id", nullable = false)
    val sheet: OrderSheetJpaEntity,
    @Column(name = "seller_id", nullable = false) val sellerId: Long,
    @Column(nullable = false) val fee: Long,
)
