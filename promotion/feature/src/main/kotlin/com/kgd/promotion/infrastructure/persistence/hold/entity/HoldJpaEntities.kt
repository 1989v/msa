package com.kgd.promotion.infrastructure.persistence.hold.entity

import com.kgd.promotion.domain.hold.model.HoldRestoration
import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import com.kgd.promotion.domain.hold.model.PromotionHold
import com.kgd.promotion.domain.hold.model.PromotionHoldStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant

/** `promotion_hold` — 주문당 한 행(order_id 유니크), `@Version`. 보류 시점 값은 생성 때만 정해진다 */
@Entity
@Table(name = "promotion_hold")
class PromotionHoldJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "order_id", nullable = false)
    val orderId: Long,
    @Column(name = "member_id", nullable = false, length = 64)
    val memberId: String,
    @Column(name = "user_coupon_id")
    val userCouponId: Long?,
    @Column(name = "coupon_definition_id")
    val couponDefinitionId: Long?,
    @Column(name = "coupon_discount", nullable = false)
    val couponDiscount: Long,
    @Column(name = "point_amount", nullable = false)
    val pointAmount: Long,
    @Enumerated(EnumType.STRING) @Column(name = "failure_reason", length = 40)
    val failureReason: PromotionFailureReason?,
    @Column(name = "expires_at", nullable = false)
    val expiresAt: Instant,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    var status: PromotionHoldStatus = PromotionHoldStatus.RESERVED
        private set

    @Column(name = "restored_point_amount", nullable = false)
    var restoredPointAmount: Long = 0
        private set

    @Column(name = "coupon_returned", nullable = false)
    var couponReturned: Boolean = false
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = createdAt
        private set

    @Version @Column(nullable = false)
    var version: Long = 0
        private set

    fun syncFrom(h: PromotionHold) {
        status = h.status
        restoredPointAmount = h.restoredPointAmount
        couponReturned = h.couponReturned
        updatedAt = h.updatedAt
    }

    fun toDomain() = PromotionHold.restore(
        requireNotNull(id), orderId, memberId, userCouponId, couponDefinitionId, couponDiscount, pointAmount, status,
        failureReason, expiresAt, restoredPointAmount, couponReturned, createdAt, updatedAt,
    )

    companion object {
        fun newFrom(h: PromotionHold) = PromotionHoldJpaEntity(
            orderId = h.orderId, memberId = h.memberId, userCouponId = h.userCouponId, couponDefinitionId = h.couponDefinitionId,
            couponDiscount = h.couponDiscount, pointAmount = h.pointAmount, failureReason = h.failureReason,
            expiresAt = h.expiresAt, createdAt = h.createdAt,
        ).apply { syncFrom(h) }
    }
}

/** `promotion_hold_restoration` — restore_key 유니크, 추가만 */
@Entity
@Table(name = "promotion_hold_restoration")
class HoldRestorationJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "restore_key", nullable = false, length = 100)
    val restoreKey: String,
    @Column(name = "order_id", nullable = false)
    val orderId: Long,
    @Column(nullable = false)
    val points: Long,
    @Column(name = "coupon_returned", nullable = false)
    val couponReturned: Boolean,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    fun toDomain() = HoldRestoration(restoreKey, orderId, points, couponReturned, createdAt)
}
