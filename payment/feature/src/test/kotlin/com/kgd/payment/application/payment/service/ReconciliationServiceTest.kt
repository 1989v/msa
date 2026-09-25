package com.kgd.payment.application.payment.service

import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.port.PgSettlementLine
import com.kgd.payment.application.payment.port.PgSettlementPort
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase
import com.kgd.payment.domain.opsissue.model.OpsIssueType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDate

/** PG 정산 파일 ↔ 결제 행 대사. 판정 근거는 운영 이슈 행과 settled 발행 호출이다. */
class ReconciliationServiceTest : BehaviorSpec({

    // T0 = 2026-09-24T01:00Z = KST 10:00 → 정산일 2026-09-24
    val settleDate = LocalDate.parse("2026-09-24")

    fun setup(): Pair<PaymentHarness, ReconciliationService> {
        val h = PaymentHarness()
        every { h.pg.authorize(any(), any()) } answers { PgResult.Approved("pk-${firstArg<String>()}") }
        every { h.pg.capture(any(), any(), any()) } answers { thirdArg() }
        listOf("ORD-1-1" to 10_000L, "ORD-2-1" to 20_000L).forEachIndexed { i, (orderNo, amount) ->
            h.commands.authorize(ProcessPaymentCommandUseCase.Authorize(i + 1L, orderNo, amount))
            h.commands.capture(orderNo)
        }
        return h to ReconciliationService(h.payments, settlement, recon(h), reconciliations, h.clock)
    }

    given("정산 파일과 결제 행") {
        then("금액이 맞으면 settled 발행, 다르거나 한쪽에만 있으면 운영 이슈") {
            val (h, service) = setup()
            every { settlement.settlementLines(settleDate) } returns listOf(
                line("ORD-1-1", "pk-ORD-1-1", 10_000L),
                line("ORD-2-1", "pk-ORD-2-1", 19_000L), // 금액 불일치
                line("ORD-9-1", "pk-ORD-9-1", 5_000L), // PG 에만 있음
            )

            service.reconcile(settleDate) shouldBe ReconcilePaymentsUseCase.Result(matched = 1, mismatched = 2, skipped = 0)

            verify(exactly = 1) { h.events.publishSettled(match { it.orderNo == "ORD-1-1" }, settleDate, any()) }
            verify(exactly = 1) { h.events.publishSettled(any(), any(), any()) }
            h.opsIssues.rows.values.map { it.type to it.targetId }.toSet() shouldBe setOf(
                OpsIssueType.RECON_MISMATCH to "ORD-2-1",
                OpsIssueType.RECON_MISMATCH to "ORD-9-1",
            )
            h.opsIssues.rows.values.forEach { it.businessDate shouldBe settleDate }
        }

        then("우리 행에만 있어도 운영 이슈, 같은 날짜를 다시 돌리면 이미 본 건은 건너뛴다") {
            val (h, service) = setup()
            every { settlement.settlementLines(settleDate) } returns listOf(line("ORD-1-1", "pk-ORD-1-1", 10_000L))

            service.reconcile(settleDate) shouldBe ReconcilePaymentsUseCase.Result(matched = 1, mismatched = 1, skipped = 0)
            service.reconcile(settleDate) shouldBe ReconcilePaymentsUseCase.Result(matched = 0, mismatched = 0, skipped = 2)

            h.opsIssues.rows.values.single().targetId shouldBe "ORD-2-1"
            verify(exactly = 1) { h.events.publishSettled(any(), any(), any()) }
        }
    }
}) {
    companion object {
        val settlement = mockk<PgSettlementPort>()
        val reconciliations = InMemoryReconciliations()

        fun recon(h: PaymentHarness) =
            ReconciliationTransactionalService(reconciliations.also { it.rows.clear() }, h.opsIssues, h.events, h.clock)

        fun line(orderNo: String, paymentKey: String, gross: Long): PgSettlementLine {
            val fee = gross * 2 / 100
            return PgSettlementLine(orderNo, paymentKey, gross, fee, gross - fee)
        }
    }
}
