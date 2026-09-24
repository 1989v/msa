package com.kgd.payment.application.payment.service

import com.kgd.payment.application.payment.port.PaymentRepositoryPort
import com.kgd.payment.application.payment.port.PgSettlementLine
import com.kgd.payment.application.payment.port.PgSettlementPort
import com.kgd.payment.application.payment.port.ReconciliationRepositoryPort
import com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase
import com.kgd.payment.domain.payment.model.Payment
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

/**
 * PG 정산 파일 ↔ 결제 행 건별 대사. 정산일은 KST 하루, 결제 쪽은 그날 매입된 행 + 파일에만 있는 주문번호의 행.
 *
 * 일치 = 양쪽에 있고, 매입 상태이고, PG 거래 키와 총액(매입액 − 환불액)이 같다. 나머지는 전부 불일치다.
 * (정산일, 주문번호)는 한 번만 판정한다 — 같은 날을 다시 돌려도 settled 가 두 번 나가지 않는다.
 */
@Service
class ReconciliationService(
    private val payments: PaymentRepositoryPort,
    private val settlement: PgSettlementPort,
    private val tx: ReconciliationTransactionalService,
    private val reconciliations: ReconciliationRepositoryPort,
    @Qualifier("paymentClock") private val clock: Clock,
) : ReconcilePaymentsUseCase {
    private val log = KotlinLogging.logger {}

    override fun reconcile(settleDate: LocalDate): ReconcilePaymentsUseCase.Result {
        val lines = settlement.settlementLines(settleDate).associateBy { it.orderNo }
        val from = settleDate.atStartOfDay(SETTLEMENT_ZONE).toInstant()
        val to = settleDate.plusDays(1).atStartOfDay(SETTLEMENT_ZONE).toInstant()
        val capturedThatDay = payments.findCapturedBetween(from, to).associateBy { it.orderNo }
        val onlyInFile = lines.keys - capturedThatDay.keys
        val byOrderNo = capturedThatDay + payments.findAllByOrderNoIn(onlyInFile).associateBy { it.orderNo }

        var matched = 0
        var mismatched = 0
        var skipped = 0
        (lines.keys + capturedThatDay.keys).sorted().forEach { orderNo ->
            if (reconciliations.exists(settleDate, orderNo)) {
                skipped++
                return@forEach
            }
            val line = lines[orderNo]
            val payment = byOrderNo[orderNo]
            if (line != null && payment != null && matches(payment, line)) {
                tx.matched(settleDate, payment, line)
                matched++
            } else {
                tx.mismatched(settleDate, orderNo, describe(line, payment))
                mismatched++
            }
        }
        log.info { "PG 대사 $settleDate: matched=$matched, mismatched=$mismatched, skipped=$skipped (at ${clock.instant()})" }
        return ReconcilePaymentsUseCase.Result(matched, mismatched, skipped)
    }

    private fun matches(p: Payment, line: PgSettlementLine): Boolean =
        p.status.isCaptured && p.paymentKey == line.paymentKey && p.refundableAmount == line.grossAmount

    private fun describe(line: PgSettlementLine?, p: Payment?): String = when {
        line == null -> "PG 정산 파일에 없음 (결제 ${p?.status}, 총액 ${p?.refundableAmount})"
        p == null -> "결제 행 없음 (PG 총액 ${line.grossAmount}, 거래 키 ${line.paymentKey})"
        else -> "불일치: PG(총액 ${line.grossAmount}, 키 ${line.paymentKey}) ↔ 결제(${p.status}, 총액 ${p.refundableAmount}, 키 ${p.paymentKey})"
    }

    companion object {
        /** 정산일 경계 — KST 자정 */
        val SETTLEMENT_ZONE: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
