package com.kgd.promotion.infrastructure.persistence.coupon.entity

import com.kgd.promotion.domain.coupon.model.UserCoupon
import com.kgd.promotion.domain.coupon.model.UserCouponStatus
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

/** `user_coupon` 행. (회원, 정의) 유니크 · `@Version` — 한 쿠폰을 두 주문이 동시에 보류하면 한쪽이 낙관적 잠금으로 진다 */
@Entity
@Table(name = "user_coupon")
class UserCouponJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false, length = 64)
    val memberId: String,
    @Column(name = "coupon_definition_id", nullable = false)
    val couponDefinitionId: Long,
    @Column(name = "issued_at", nullable = false)
    val issuedAt: Instant,
) {
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    var status: UserCouponStatus = UserCouponStatus.AVAILABLE
        private set

    @Column(name = "reserved_order_id")
    var reservedOrderId: Long? = null
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = issuedAt
        private set

    @Version @Column(nullable = false)
    var version: Long = 0
        private set

    fun syncFrom(c: UserCoupon) {
        status = c.status
        reservedOrderId = c.reservedOrderId
        updatedAt = c.updatedAt
    }

    fun toDomain() = UserCoupon.restore(requireNotNull(id), memberId, couponDefinitionId, status, reservedOrderId, issuedAt, updatedAt)

    companion object {
        fun newFrom(c: UserCoupon) =
            UserCouponJpaEntity(memberId = c.memberId, couponDefinitionId = c.couponDefinitionId, issuedAt = c.issuedAt).apply { syncFrom(c) }
    }
}
