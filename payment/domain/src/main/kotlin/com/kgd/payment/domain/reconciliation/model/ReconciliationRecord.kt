package com.kgd.payment.domain.reconciliation.model

import java.time.Instant
import java.time.LocalDate

/** 정산일 × 주문번호 대사 결과. 같은 (정산일, 주문번호)는 한 번만 판정한다. */
data class ReconciliationRecord(
    val settleDate: LocalDate,
    val orderNo: String,
    val result: ReconciliationResult,
    val grossAmount: Long?,
    val pgFee: Long?,
    val createdAt: Instant,
)

enum class ReconciliationResult { MATCHED, MISMATCH }
