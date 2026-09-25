package com.kgd.payment.infrastructure.pg.mock

import com.kgd.payment.application.payment.port.PgCallException
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgPort
import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.port.PgSettlementLine
import com.kgd.payment.application.payment.port.PgSettlementPort
import com.kgd.payment.application.payment.service.ReconciliationService
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import java.time.LocalDate

/**
 * 모의 PG — 기본값(`payment.pg=mock` 또는 미설정). 서버가 승인을 요청하는 흐름이고, 운영에서는 항상 승인한다.
 * 결정적이다: 거래 키는 `mock-{orderNo}`, PG 수수료는 총액의 2%(반올림).
 *
 * PG 쪽 멱등도 흉내 낸다 — 이미 거래가 있는 orderNo 로 다시 승인을 요청하면 새 거래를 만들지 않고 기존 결과를 준다.
 * 웹훅은 HTTP 로 받지 않는다: 결론은 재조회([inquire])로만 나고, 그 경로가 토스 웹훅과 같은 전이 함수를 탄다.
 */
@Component
@ConditionalOnProperty(prefix = "payment", name = ["pg"], havingValue = "mock", matchIfMissing = true)
class MockPgAdapter(
    private val ledger: MockPgTransactionJpaRepository,
    scenario: ObjectProvider<MockPgScenario>,
    private val recorder: MockPgCallRecorder,
    @Qualifier("paymentClock") private val clock: Clock,
) : PgPort, PgSettlementPort {

    private val scenario: MockPgScenario = scenario.getIfAvailable { MockPgScenario.approve() }

    override fun authorize(orderNo: String, amount: Long): PgResult {
        recorder.record(MockPgCallRecorder.Op.AUTHORIZE, orderNo)
        return approve(orderNo, amount, keyOf(orderNo))
    }

    override fun confirm(paymentKey: String, orderNo: String, amount: Long): PgResult {
        recorder.record(MockPgCallRecorder.Op.CONFIRM, orderNo)
        return approve(orderNo, amount, paymentKey)
    }

    private fun approve(orderNo: String, amount: Long, paymentKey: String): PgResult {
        ledger.findByOrderNo(orderNo)?.let { return resultOf(it) }
        val outcome = scenario.onAuthorize(orderNo, amount)
        val status = when (outcome) {
            MockPgScenario.Outcome.APPROVE -> MockPgTxStatus.APPROVED
            MockPgScenario.Outcome.DECLINE -> MockPgTxStatus.DECLINED
            MockPgScenario.Outcome.TIMEOUT -> MockPgTxStatus.PENDING
        }
        val now = clock.instant()
        val saved = ledger.save(MockPgTransactionJpaEntity(orderNo = orderNo, paymentKey = paymentKey, amount = amount, status = status, createdAt = now, updatedAt = now))
        return if (outcome == MockPgScenario.Outcome.TIMEOUT) PgResult.Unknown("MOCK_TIMEOUT") else resultOf(saved)
    }

    override fun inquire(orderNo: String): PgInquiry {
        recorder.record(MockPgCallRecorder.Op.INQUIRE, orderNo)
        val tx = ledger.findByOrderNo(orderNo) ?: return PgInquiry.NotFound
        if (tx.status == MockPgTxStatus.PENDING) {
            val n = recorder.count(MockPgCallRecorder.Op.INQUIRE, orderNo)
            when (scenario.onInquire(orderNo, n)) {
                MockPgScenario.Outcome.APPROVE -> update(tx, MockPgTxStatus.APPROVED)
                MockPgScenario.Outcome.DECLINE -> update(tx, MockPgTxStatus.DECLINED)
                MockPgScenario.Outcome.TIMEOUT -> return PgInquiry.Unavailable("MOCK_PENDING")
            }
        }
        return when (tx.status) {
            MockPgTxStatus.APPROVED, MockPgTxStatus.CAPTURED -> PgInquiry.Approved(tx.paymentKey, tx.amount)
            MockPgTxStatus.DECLINED -> PgInquiry.Declined(DECLINED)
            MockPgTxStatus.CANCELED -> PgInquiry.Declined("MOCK_CANCELED")
            MockPgTxStatus.PENDING -> PgInquiry.Unavailable("MOCK_PENDING")
        }
    }

    /** 매입 시각은 결제 쪽이 넘긴 값을 그대로 원장에 쓴다. 이미 매입된 거래면 처음 기록한 시각을 돌려준다 */
    override fun capture(paymentKey: String, amount: Long, capturedAt: Instant): Instant {
        recorder.record(MockPgCallRecorder.Op.CAPTURE, paymentKey)
        val tx = byKey(paymentKey)
        if (tx.status == MockPgTxStatus.CAPTURED) return requireNotNull(tx.capturedAt)
        if (scenario.onCapture(tx.orderNo, amount) != MockPgScenario.Outcome.APPROVE) {
            throw PgCallException("모의 PG: 매입 응답 없음", retryable = true)
        }
        check(tx.status == MockPgTxStatus.APPROVED) { "모의 PG: 승인되지 않은 거래는 매입할 수 없다 (${tx.status})" }
        tx.capturedAmount = amount
        tx.capturedAt = capturedAt
        update(tx, MockPgTxStatus.CAPTURED)
        return capturedAt
    }

    override fun void(paymentKey: String, amount: Long) {
        recorder.record(MockPgCallRecorder.Op.VOID, paymentKey)
        val tx = byKey(paymentKey)
        if (tx.status == MockPgTxStatus.CANCELED) return
        if (tx.status != MockPgTxStatus.APPROVED) throw PgCallException("모의 PG: 매입 전 승인만 취소한다 (${tx.status})", retryable = false)
        update(tx, MockPgTxStatus.CANCELED)
    }

    override fun refund(paymentKey: String, amount: Long, refundKey: String, reason: String?) {
        recorder.record(MockPgCallRecorder.Op.REFUND, paymentKey)
        val tx = byKey(paymentKey)
        if (tx.status != MockPgTxStatus.CAPTURED || tx.refundedAmount + amount > tx.capturedAmount) {
            throw PgCallException("모의 PG: 환불 불가 (${tx.status}, 매입 ${tx.capturedAmount}, 환불 ${tx.refundedAmount})", retryable = false)
        }
        tx.refundedAmount += amount
        update(tx, MockPgTxStatus.CAPTURED)
    }

    /** 정산 파일 — 정산일(KST)에 매입된 거래. 총액 = 매입액 − 환불액, 수수료 = 총액의 2% 반올림 */
    override fun settlementLines(settleDate: LocalDate): List<PgSettlementLine> {
        val zone = ReconciliationService.SETTLEMENT_ZONE
        return ledger.findAllByStatusAndCapturedAtGreaterThanEqualAndCapturedAtLessThanOrderByIdAsc(
            MockPgTxStatus.CAPTURED,
            settleDate.atStartOfDay(zone).toInstant(),
            settleDate.plusDays(1).atStartOfDay(zone).toInstant(),
        ).map { tx ->
            val gross = tx.capturedAmount - tx.refundedAmount
            val fee = (gross * FEE_PERCENT + 50) / 100
            PgSettlementLine(tx.orderNo, tx.paymentKey, gross, fee, gross - fee)
        }
    }

    private fun resultOf(tx: MockPgTransactionJpaEntity): PgResult = when (tx.status) {
        MockPgTxStatus.APPROVED, MockPgTxStatus.CAPTURED -> PgResult.Approved(tx.paymentKey)
        MockPgTxStatus.PENDING -> PgResult.Unknown("MOCK_PENDING")
        MockPgTxStatus.DECLINED, MockPgTxStatus.CANCELED -> PgResult.Declined(DECLINED)
    }

    private fun byKey(paymentKey: String) =
        ledger.findByPaymentKey(paymentKey) ?: throw PgCallException("모의 PG: 거래 없음 ($paymentKey)", retryable = false)

    private fun update(tx: MockPgTransactionJpaEntity, status: MockPgTxStatus) {
        tx.status = status
        tx.updatedAt = clock.instant()
        ledger.save(tx)
    }

    private companion object {
        const val DECLINED = "MOCK_DECLINED"
        const val FEE_PERCENT = 2L

        fun keyOf(orderNo: String) = "mock-$orderNo"
    }
}
