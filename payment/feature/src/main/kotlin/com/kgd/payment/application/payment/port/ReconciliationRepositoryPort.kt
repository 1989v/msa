package com.kgd.payment.application.payment.port

import com.kgd.payment.domain.reconciliation.model.ReconciliationRecord
import java.time.LocalDate

interface ReconciliationRepositoryPort {
    fun exists(settleDate: LocalDate, orderNo: String): Boolean
    fun save(record: ReconciliationRecord)

    /** 운영자 재시도 — 판정을 지워 다음 대사가 다시 보게 한다 */
    fun delete(settleDate: LocalDate, orderNo: String)
}
