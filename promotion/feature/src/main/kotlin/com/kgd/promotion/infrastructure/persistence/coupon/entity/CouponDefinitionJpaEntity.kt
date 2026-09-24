package com.kgd.promotion.infrastructure.persistence.coupon.entity

import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponDefinition
import com.kgd.promotion.domain.coupon.model.CouponDefinitionStatus
import com.kgd.promotion.domain.coupon.model.CouponType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * `coupon_definition` 행. 만든 뒤 바뀌는 컬럼은 `issued_count` 하나이고 그것도 저장소의 조건부 UPDATE 만 바꾼다 —
 * 그래서 이 엔티티의 필드는 전부 val 이다(엔티티 저장이 발행 수를 옛 값으로 덮지 않게).
 */
@Entity
@Table(name = "coupon_definition")
class CouponDefinitionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, length = 100)
    val name: String,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    val type: CouponType,
    val amount: Long?,
    @Column(name = "rate_bp")
    val rateBp: Int?,
    @Column(name = "max_discount")
    val maxDiscount: Long?,
    @Column(name = "min_order_amount", nullable = false)
    val minOrderAmount: Long,
    @Column(name = "valid_from", nullable = false)
    val validFrom: Instant,
    @Column(name = "valid_until", nullable = false)
    val validUntil: Instant,
    @Column(name = "issue_limit", nullable = false)
    val issueLimit: Int,
    @Column(name = "issued_count", nullable = false)
    val issuedCount: Int,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    val bearer: CouponBearer,
    @Column(name = "seller_id")
    val sellerId: Long?,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    val status: CouponDefinitionStatus,
    @Column(name = "created_by", nullable = false, length = 64)
    val createdBy: String,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    fun toDomain() = CouponDefinition.restore(
        requireNotNull(id), name, type, amount, rateBp, maxDiscount, minOrderAmount, validFrom, validUntil, issueLimit,
        issuedCount, bearer, sellerId, status, createdBy, createdAt,
    )

    companion object {
        fun newFrom(d: CouponDefinition) = CouponDefinitionJpaEntity(
            name = d.name, type = d.type, amount = d.amount, rateBp = d.rateBp, maxDiscount = d.maxDiscount,
            minOrderAmount = d.minOrderAmount, validFrom = d.validFrom, validUntil = d.validUntil, issueLimit = d.issueLimit,
            issuedCount = d.issuedCount, bearer = d.bearer, sellerId = d.sellerId, status = d.status,
            createdBy = d.createdBy, createdAt = d.createdAt,
        )
    }
}
