package com.kgd.promotion.infrastructure.persistence.point.entity

import com.kgd.promotion.domain.point.model.PointBalance
import com.kgd.promotion.domain.point.model.PointLedgerEntry
import com.kgd.promotion.domain.point.model.PointLedgerType
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

/** `point_balance` — 회원당 한 행, `@Version`. 잔액 음수는 도메인과 DB CHECK 가 둘 다 막는다 */
@Entity
@Table(name = "point_balance")
class PointBalanceJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false, length = 64)
    val memberId: String,
    balance: Long,
    updatedAt: Instant,
) {
    @Column(nullable = false)
    var balance: Long = balance
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = updatedAt
        private set

    @Version @Column(nullable = false)
    var version: Long = 0
        private set

    fun syncFrom(b: PointBalance) {
        balance = b.balance
        updatedAt = b.updatedAt
    }

    fun toDomain() = PointBalance.restore(requireNotNull(id), memberId, balance, updatedAt)
}

/** `point_ledger` — 추가만 한다. 수정 메서드가 없다 */
@Entity
@Table(name = "point_ledger")
class PointLedgerJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false, length = 64)
    val memberId: String,
    @Column(nullable = false)
    val delta: Long,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    val type: PointLedgerType,
    @Column(name = "balance_after", nullable = false)
    val balanceAfter: Long,
    @Column(name = "order_id")
    val orderId: Long?,
    @Column(name = "idempotency_key", nullable = false, length = 120)
    val idempotencyKey: String,
    @Column(name = "actor_id", length = 64)
    val actorId: String?,
    @Column(length = 500)
    val reason: String?,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    fun toDomain() = PointLedgerEntry(memberId, delta, type, balanceAfter, orderId, idempotencyKey, actorId, reason, createdAt, id)

    companion object {
        fun from(e: PointLedgerEntry) = PointLedgerJpaEntity(
            memberId = e.memberId, delta = e.delta, type = e.type, balanceAfter = e.balanceAfter, orderId = e.orderId,
            idempotencyKey = e.idempotencyKey, actorId = e.actorId, reason = e.reason?.take(500), createdAt = e.createdAt,
        )
    }
}
