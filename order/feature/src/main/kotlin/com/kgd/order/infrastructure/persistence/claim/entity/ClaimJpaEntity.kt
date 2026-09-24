package com.kgd.order.infrastructure.persistence.claim.entity

import com.kgd.order.domain.claim.model.ClaimStatus
import com.kgd.order.domain.claim.model.ClaimStep
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

/**
 * 클레임 행 — 주문 한 건 · 판매자 한 명. `@Version` 이 같은 클레임을 동시에 옮기는 두 트랜잭션 중 늦은 쪽을 되돌린다.
 * 라인 번호는 쉼표로 담는다(조건으로 찾지 않는다).
 */
@Entity
@Table(name = "order_claim")
class ClaimJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "order_id", nullable = false) val orderId: Long,
    @Column(name = "user_id", nullable = false, length = 100) val userId: String,
    @Column(name = "seller_id", nullable = false) val sellerId: Long,
    @Column(name = "line_nos", nullable = false, length = 500) val lineNos: String,
    @Column(name = "requested_at", nullable = false) val requestedAt: Instant,
) {
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    var status: ClaimStatus = ClaimStatus.REQUESTED

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30)
    var step: ClaimStep = ClaimStep.QUEUED

    @Column(name = "goods_shipped", nullable = false) var goodsShipped: Boolean = false
    @Column(name = "refund_amount") var refundAmount: Long? = null
    @Column(name = "point_restore") var pointRestore: Long? = null
    @Column(name = "shipping_refund") var shippingRefund: Long? = null
    @Column(name = "full_cancel") var fullCancel: Boolean? = null
    @Column(name = "restore_promotion") var restorePromotion: Boolean? = null
    @Column(name = "reject_reason", length = 500) var rejectReason: String? = null
    @Column(name = "decided_by", length = 150) var decidedBy: String? = null
    @Column(nullable = false) var attempts: Int = 0
    @Column(name = "next_deadline_at") var nextDeadlineAt: Instant? = null
    @Column(nullable = false) var stuck: Boolean = false
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = requestedAt

    @Version
    @Column(nullable = false)
    var version: Long = 0
        private set
}
