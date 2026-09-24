package com.kgd.seller.infrastructure.persistence.adminaction.entity

import com.kgd.seller.domain.seller.model.SellerAdminAction
import com.kgd.seller.domain.seller.model.SellerAdminActionType
import com.kgd.seller.domain.seller.model.SellerStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** 어드민 조치 이력 — 추가만 한다 */
@Entity
@Table(name = "seller_admin_action")
class SellerAdminActionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val sellerId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    val action: SellerAdminActionType,

    @Column(nullable = false, length = 64)
    val actorId: String,

    @Column(length = 500)
    val reason: String?,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val fromStatus: SellerStatus,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val toStatus: SellerStatus,

    @Column(name = "commission_rate_bp")
    val commissionRateBp: Int?,

    @Column(nullable = false)
    val createdAt: Instant,
) {
    fun toDomain(): SellerAdminAction =
        SellerAdminAction(sellerId, action, actorId, reason, fromStatus, toStatus, commissionRateBp, createdAt)

    companion object {
        fun from(a: SellerAdminAction) = SellerAdminActionJpaEntity(
            sellerId = a.sellerId,
            action = a.action,
            actorId = a.actorId,
            reason = a.reason,
            fromStatus = a.fromStatus,
            toStatus = a.toStatus,
            commissionRateBp = a.commissionRateBp,
            createdAt = a.createdAt,
        )
    }
}
