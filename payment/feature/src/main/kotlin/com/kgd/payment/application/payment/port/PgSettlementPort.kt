package com.kgd.payment.application.payment.port

import java.time.LocalDate

/** PG 정산 파일 — 정산일에 매입된 거래별 총액·PG 수수료·입금액 */
interface PgSettlementPort {
    fun settlementLines(settleDate: LocalDate): List<PgSettlementLine>
}

data class PgSettlementLine(
    val orderNo: String,
    val paymentKey: String,
    /** 매입액 − 환불액 */
    val grossAmount: Long,
    val pgFee: Long,
    val depositAmount: Long,
)
