package com.kgd.settlement.application.ledger.service

import com.kgd.settlement.application.SettlementHarness
import com.kgd.settlement.application.ledger.usecase.RecordLedgerUseCase
import com.kgd.settlement.domain.ledger.exception.InvalidJournalException
import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.ledger.model.JournalType
import com.kgd.settlement.domain.ledger.model.LineAmounts
import com.kgd.settlement.domain.ledger.model.ShippingAmount
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.LocalDate

class LedgerServiceTest : BehaviorSpec({

    val t0 = Instant.parse("2026-09-24T03:00:00Z")
    val mug = LineAmounts(11L, 7L, netSales = 23_000L, commission = 2_300L, platformCoupon = 1_500L, point = 600L)
    val coaster = LineAmounts(12L, 9L, netSales = 8_000L, commission = 400L, platformCoupon = 500L, point = 400L)
    val capture = RecordLedgerUseCase.Capture(
        orderId = 501L, payableAmount = 33_500L, lines = listOf(mug, coaster),
        shipping = listOf(ShippingAmount(7L, 3_000L), ShippingAmount(9L, 2_500L)), confirmedAt = t0, eventId = "evt-a",
    )
    val refund = RecordLedgerUseCase.Refund(
        claimId = 31L, orderId = 501L, refundAmount = 9_600L, lines = listOf(coaster),
        shipping = listOf(ShippingAmount(9L, 2_500L)), refundedAt = t0.plusSeconds(60), eventId = "evt-b",
    )

    Given("같은 원천 이벤트가 두 번 온다") {
        Then("매입: 재배달(같은 id)도 재발행(새 id)도 거래 1건") {
            val h = SettlementHarness(t0)
            h.ledger.recordCapture(capture) shouldBe true
            h.ledger.recordCapture(capture) shouldBe false
            h.ledger.recordCapture(capture.copy(eventId = "evt-a-republished")) shouldBe false
            h.journals.journals.count { it.type == JournalType.CAPTURE } shouldBe 1
            h.journals.journals.single().sourceEventId shouldBe "evt-a"
        }
        Then("환불·PG 입금도 원천(클레임·정산일+주문번호)당 1건") {
            val h = SettlementHarness(t0)
            h.ledger.recordCapture(capture)
            repeat(2) { h.ledger.recordRefund(refund) }
            val deposit = RecordLedgerUseCase.PgDeposit(501L, "ORD-501-1", LocalDate.of(2026, 9, 24), 22_895L, 1_005L, "evt-c")
            repeat(2) { h.ledger.recordPgDeposit(deposit) }
            h.journals.journals.map { it.type } shouldBe listOf(JournalType.CAPTURE, JournalType.REFUND, JournalType.PG_DEPOSIT)
        }
    }

    Given("같은 정산일에 매입과 전액 환불이 겹쳐 입금액·수수료가 0 인 PG 입금") {
        Then("예외 없이 분개하지 않는다 — 움직인 돈이 없다") {
            val h = SettlementHarness(t0)
            h.ledger.recordPgDeposit(RecordLedgerUseCase.PgDeposit(1L, "ORD-1-1", LocalDate.of(2026, 9, 24), 0L, 0L, "evt-zero")) shouldBe false
            h.journals.journals.count { it.type == JournalType.PG_DEPOSIT } shouldBe 0
        }
    }

    Given("환불 기록") {
        Then("환불 거래와 함께 환불된 라인·배송비 키를 남긴다 — 정산서가 거르는 근거") {
            val h = SettlementHarness(t0)
            h.ledger.recordCapture(capture)
            h.ledger.recordRefund(refund)
            h.refunded.keys.keys shouldBe setOf("line:12", "shipping:501:9")
            h.payableOf(9L) shouldBe 0L
            h.payableOf(7L) shouldBe 23_000L + 3_000L - 2_300L
        }
        Then("검산이 맞지 않는 환불은 거래도 키도 남기지 않는다(예외 → DLT)") {
            val h = SettlementHarness(t0)
            shouldThrow<InvalidJournalException> { h.ledger.recordRefund(refund.copy(refundAmount = 9_601L)) }
            h.journals.journals.size shouldBe 0
            h.refunded.keys.size shouldBe 0
        }
    }

    Given("매입·환불·PG 입금을 기록한 원장") {
        Then("시산표: 계정별 합을 모두 더하면 0, 여섯 계정이 전부 나온다") {
            val h = SettlementHarness(t0)
            h.ledger.recordCapture(capture)
            h.ledger.recordRefund(refund)
            h.ledger.recordPgDeposit(RecordLedgerUseCase.PgDeposit(501L, "ORD-501-1", LocalDate.of(2026, 9, 24), 22_895L, 1_005L, "evt-c"))

            val tb = h.ledger.trialBalance()
            tb.accounts.map { it.account } shouldBe Account.entries
            tb.net shouldBe 0L
            tb.totalDebit shouldBe 36_500L + 10_500L + 23_900L
            tb.accounts.single { it.account == Account.PG_RECEIVABLE }.balance shouldBe 0L
            tb.sellerPayables.associate { it.sellerId to it.balance } shouldBe mapOf(7L to 23_700L, 9L to 0L)
        }
    }
})
