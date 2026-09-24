package com.kgd.payment.application.payment.usecase

import java.time.LocalDate

/** PG 정산 파일 ↔ 결제 행 대사(일 1회). 불일치·한쪽만 있음은 운영 이슈, 일치는 `payment.reconciliation.settled` */
interface ReconcilePaymentsUseCase {
    fun reconcile(settleDate: LocalDate): Result

    data class Result(val matched: Int, val mismatched: Int, val skipped: Int)
}
