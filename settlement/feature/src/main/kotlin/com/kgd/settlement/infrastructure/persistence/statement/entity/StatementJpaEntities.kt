package com.kgd.settlement.infrastructure.persistence.statement.entity

import com.kgd.settlement.domain.statement.model.SettlementItem
import com.kgd.settlement.domain.statement.model.SettlementItemKind
import com.kgd.settlement.domain.statement.model.SettlementPeriod
import com.kgd.settlement.domain.statement.model.SettlementStatement
import com.kgd.settlement.domain.statement.model.StatementStatus
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import org.hibernate.annotations.Immutable
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(name = "settlement_item")
class SettlementItemJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "item_key", nullable = false, length = 80)
    val itemKey: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val kind: SettlementItemKind,

    @Column(name = "order_id", nullable = false)
    val orderId: Long,

    @Column(name = "order_item_id")
    val orderItemId: Long?,

    @Column(name = "seller_id", nullable = false)
    val sellerId: Long,

    @Column(name = "net_sales", nullable = false)
    val netSales: Long,

    @Column(nullable = false)
    val commission: Long,

    @Column(name = "shipping_fee", nullable = false)
    val shippingFee: Long,

    @Column(name = "confirmed_at", nullable = false)
    val confirmedAt: Instant,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    /** 묶인 정산서 — 비어 있으면 아직 정산 전(이월된 항목도 비어 있다). 갱신은 조건부 UPDATE 로만 */
    @Column(name = "statement_id")
    var statementId: Long? = null
        private set

    fun toDomain() = SettlementItem(itemKey, kind, orderId, orderItemId, sellerId, netSales, commission, shippingFee, confirmedAt)

    companion object {
        fun from(i: SettlementItem, now: Instant) = SettlementItemJpaEntity(
            itemKey = i.key, kind = i.kind, orderId = i.orderId, orderItemId = i.orderItemId, sellerId = i.sellerId,
            netSales = i.netSales, commission = i.commission, shippingFee = i.shippingFee, confirmedAt = i.confirmedAt, createdAt = now,
        )
    }
}

@Entity
@Immutable
@Table(name = "settlement_refunded_item")
class SettlementRefundedItemJpaEntity(
    @Id
    @Column(name = "item_key", nullable = false, length = 80)
    val itemKey: String,

    @Column(name = "claim_id", nullable = false)
    val claimId: Long,

    @Column(name = "refunded_at", nullable = false)
    val refundedAt: Instant,
)

@Entity
@Table(name = "settlement_statement")
class SettlementStatementJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "seller_id", nullable = false)
    val sellerId: Long,

    @Column(name = "period_start", nullable = false)
    val periodStart: LocalDate,

    @Column(name = "period_end", nullable = false)
    val periodEnd: LocalDate,

    @Column(name = "net_sales", nullable = false)
    val netSales: Long,

    @Column(name = "shipping_fee", nullable = false)
    val shippingFee: Long,

    @Column(nullable = false)
    val commission: Long,

    @Column(nullable = false)
    val payout: Long,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: StatementStatus = StatementStatus.DRAFT
        private set

    @Column(name = "payout_reference", length = 100)
    var payoutReference: String? = null
        private set

    @Column(name = "confirmed_at")
    var confirmedAt: Instant? = null
        private set

    @Column(name = "paid_at")
    var paidAt: Instant? = null
        private set

    @Column(name = "carried_over_at")
    var carriedOverAt: Instant? = null
        private set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = createdAt
        private set

    @Version
    @Column(nullable = false)
    var version: Long = 0

    /** 상태·시각만 옮긴다 — 금액·기간·줄은 만든 뒤 바뀌지 않는다 */
    fun syncFrom(s: SettlementStatement, now: Instant) {
        status = s.status
        payoutReference = s.payoutReference
        confirmedAt = s.confirmedAt
        paidAt = s.paidAt
        carriedOverAt = s.carriedOverAt
        updatedAt = now
    }

    fun toDomain(lines: List<SettlementItem>) = SettlementStatement.restore(
        requireNotNull(id), sellerId, SettlementPeriod(periodStart, periodEnd), status, lines, createdAt,
        confirmedAt, paidAt, carriedOverAt, payoutReference,
    )

    companion object {
        fun newFrom(s: SettlementStatement, now: Instant) = SettlementStatementJpaEntity(
            sellerId = s.sellerId, periodStart = s.period.start, periodEnd = s.period.endExclusive,
            netSales = s.netSales, shippingFee = s.shippingFee, commission = s.commission, payout = s.payout, createdAt = s.createdAt,
        ).apply { syncFrom(s, now) }
    }
}

@Entity
@Immutable
@Table(name = "settlement_statement_line")
class SettlementStatementLineJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "statement_id", nullable = false)
    val statementId: Long,

    @Column(name = "item_key", nullable = false, length = 80)
    val itemKey: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val kind: SettlementItemKind,

    @Column(name = "order_id", nullable = false)
    val orderId: Long,

    @Column(name = "order_item_id")
    val orderItemId: Long?,

    @Column(name = "net_sales", nullable = false)
    val netSales: Long,

    @Column(nullable = false)
    val commission: Long,

    @Column(name = "shipping_fee", nullable = false)
    val shippingFee: Long,

    @Column(name = "confirmed_at", nullable = false)
    val confirmedAt: Instant,
) {
    fun toDomain(sellerId: Long) = SettlementItem(itemKey, kind, orderId, orderItemId, sellerId, netSales, commission, shippingFee, confirmedAt)

    companion object {
        fun from(statementId: Long, i: SettlementItem) = SettlementStatementLineJpaEntity(
            statementId = statementId, itemKey = i.key, kind = i.kind, orderId = i.orderId, orderItemId = i.orderItemId,
            netSales = i.netSales, commission = i.commission, shippingFee = i.shippingFee, confirmedAt = i.confirmedAt,
        )
    }
}
