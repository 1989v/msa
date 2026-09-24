package com.kgd.payment.infrastructure.persistence.reconciliation.entity

import com.kgd.payment.domain.reconciliation.model.ReconciliationRecord
import com.kgd.payment.domain.reconciliation.model.ReconciliationResult
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.time.LocalDate

/** (정산일, 주문번호) 대사 판정. 유니크 — 같은 건을 두 번 판정하지 않는다 */
@Entity
@Table(name = "payment_reconciliation")
class ReconciliationJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "settle_date", nullable = false)
    val settleDate: LocalDate,

    @Column(name = "order_no", nullable = false, length = 64)
    val orderNo: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val result: ReconciliationResult,

    @Column(name = "gross_amount")
    val grossAmount: Long?,

    @Column(name = "pg_fee")
    val pgFee: Long?,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant,
) {
    companion object {
        fun from(r: ReconciliationRecord) =
            ReconciliationJpaEntity(settleDate = r.settleDate, orderNo = r.orderNo, result = r.result, grossAmount = r.grossAmount, pgFee = r.pgFee, createdAt = r.createdAt)
    }
}
