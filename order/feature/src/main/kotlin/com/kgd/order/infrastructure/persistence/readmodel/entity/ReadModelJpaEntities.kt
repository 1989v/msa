package com.kgd.order.infrastructure.persistence.readmodel.entity

import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.benefit.model.CouponDefinitionView
import com.kgd.order.domain.benefit.model.CouponType
import com.kgd.order.domain.benefit.model.PointBalanceView
import com.kgd.order.domain.benefit.model.UserCouponView
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * 읽기 모델 행 — id 는 원천 도메인의 id 를 그대로 쓴다(생성하지 않는다).
 * 갱신은 이벤트가 가진 값 전체로 덮어쓴다(entity-mutation.md 의 전체 동기화).
 */
@Entity
@Table(name = "product_view")
class ProductViewJpaEntity(
    @Id @Column(name = "product_id") val productId: Long,
    name: String,
    price: Long,
    status: String,
    sellerId: Long,
    occurredAt: Instant,
) {
    @Column(nullable = false, length = 255) var name: String = name; private set
    @Column(nullable = false) var price: Long = price; private set
    @Column(nullable = false, length = 20) var status: String = status; private set
    @Column(name = "seller_id", nullable = false) var sellerId: Long = sellerId; private set
    @Column(name = "occurred_at", nullable = false) var occurredAt: Instant = occurredAt; private set

    fun overwrite(view: ProductView) {
        name = view.name; price = view.price; status = view.status; sellerId = view.sellerId; occurredAt = view.occurredAt
    }

    fun toDomain() = ProductView(productId, name, price, status, sellerId, occurredAt)

    companion object {
        fun from(view: ProductView) =
            ProductViewJpaEntity(view.productId, view.name, view.price, view.status, view.sellerId, view.occurredAt)
    }
}

@Entity
@Table(name = "seller_view")
class SellerViewJpaEntity(
    @Id @Column(name = "seller_id") val sellerId: Long,
    status: String,
    commissionRateBp: Int?,
    shippingFee: Long,
    occurredAt: Instant,
) {
    @Column(nullable = false, length = 20) var status: String = status; private set
    @Column(name = "commission_rate_bp") var commissionRateBp: Int? = commissionRateBp; private set
    @Column(name = "shipping_fee", nullable = false) var shippingFee: Long = shippingFee; private set
    @Column(name = "occurred_at", nullable = false) var occurredAt: Instant = occurredAt; private set

    fun overwrite(view: SellerView) {
        status = view.status; commissionRateBp = view.commissionRateBp; shippingFee = view.shippingFee; occurredAt = view.occurredAt
    }

    fun toDomain() = SellerView(sellerId, status, commissionRateBp, shippingFee, occurredAt)

    companion object {
        fun from(view: SellerView) =
            SellerViewJpaEntity(view.sellerId, view.status, view.commissionRateBp, view.shippingFee, view.occurredAt)
    }
}

@Entity
@Table(name = "coupon_definition_view")
class CouponDefinitionViewJpaEntity(
    @Id @Column(name = "coupon_definition_id") val couponDefinitionId: Long,
    type: CouponType,
    amount: Long?,
    rateBp: Int?,
    maxDiscount: Long?,
    minOrderAmount: Long,
    validFrom: Instant,
    validUntil: Instant,
    bearer: CouponBearer,
    sellerId: Long?,
    status: String,
    occurredAt: Instant,
) {
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10) var type: CouponType = type; private set
    @Column var amount: Long? = amount; private set
    @Column(name = "rate_bp") var rateBp: Int? = rateBp; private set
    @Column(name = "max_discount") var maxDiscount: Long? = maxDiscount; private set
    @Column(name = "min_order_amount", nullable = false) var minOrderAmount: Long = minOrderAmount; private set
    @Column(name = "valid_from", nullable = false) var validFrom: Instant = validFrom; private set
    @Column(name = "valid_until", nullable = false) var validUntil: Instant = validUntil; private set
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10) var bearer: CouponBearer = bearer; private set
    @Column(name = "seller_id") var sellerId: Long? = sellerId; private set
    @Column(nullable = false, length = 20) var status: String = status; private set
    @Column(name = "occurred_at", nullable = false) var occurredAt: Instant = occurredAt; private set

    fun overwrite(v: CouponDefinitionView) {
        type = v.type; amount = v.amount; rateBp = v.rateBp; maxDiscount = v.maxDiscount; minOrderAmount = v.minOrderAmount
        validFrom = v.validFrom; validUntil = v.validUntil; bearer = v.bearer; sellerId = v.sellerId; status = v.status
        occurredAt = v.occurredAt
    }

    fun toDomain() = CouponDefinitionView(
        couponDefinitionId, type, amount, rateBp, maxDiscount, minOrderAmount, validFrom, validUntil, bearer, sellerId, status,
        occurredAt,
    )

    companion object {
        fun from(v: CouponDefinitionView) = CouponDefinitionViewJpaEntity(
            v.couponDefinitionId, v.type, v.amount, v.rateBp, v.maxDiscount, v.minOrderAmount, v.validFrom, v.validUntil,
            v.bearer, v.sellerId, v.status, v.occurredAt,
        )
    }
}

@Entity
@Table(name = "user_coupon_view")
class UserCouponViewJpaEntity(
    @Id @Column(name = "user_coupon_id") val userCouponId: Long,
    memberId: String,
    couponDefinitionId: Long,
    status: String,
    occurredAt: Instant,
) {
    @Column(name = "member_id", nullable = false, length = 64) var memberId: String = memberId; private set
    @Column(name = "coupon_definition_id", nullable = false) var couponDefinitionId: Long = couponDefinitionId; private set
    @Column(nullable = false, length = 20) var status: String = status; private set
    @Column(name = "occurred_at", nullable = false) var occurredAt: Instant = occurredAt; private set

    fun overwrite(v: UserCouponView) {
        memberId = v.memberId; couponDefinitionId = v.couponDefinitionId; status = v.status; occurredAt = v.occurredAt
    }

    fun toDomain() = UserCouponView(userCouponId, memberId, couponDefinitionId, status, occurredAt)

    companion object {
        fun from(v: UserCouponView) = UserCouponViewJpaEntity(v.userCouponId, v.memberId, v.couponDefinitionId, v.status, v.occurredAt)
    }
}

@Entity
@Table(name = "point_balance_view")
class PointBalanceViewJpaEntity(
    @Id @Column(name = "member_id", length = 64) val memberId: String,
    balance: Long,
    occurredAt: Instant,
) {
    @Column(nullable = false) var balance: Long = balance; private set
    @Column(name = "occurred_at", nullable = false) var occurredAt: Instant = occurredAt; private set

    fun overwrite(v: PointBalanceView) {
        balance = v.balance; occurredAt = v.occurredAt
    }

    fun toDomain() = PointBalanceView(memberId, balance, occurredAt)

    companion object {
        fun from(v: PointBalanceView) = PointBalanceViewJpaEntity(v.memberId, v.balance, v.occurredAt)
    }
}
