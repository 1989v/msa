package com.kgd.payment.infrastructure.pg.mock

import com.kgd.payment.application.payment.port.PaymentEventPort
import com.kgd.payment.application.payment.service.InMemoryOpsIssues
import com.kgd.payment.application.payment.service.InMemoryPayments
import com.kgd.payment.application.payment.service.InMemoryReconciliations
import com.kgd.payment.application.payment.service.InMemoryRefunds
import com.kgd.payment.application.payment.service.PaymentCommandService
import com.kgd.payment.application.payment.service.PaymentTransactionalService
import com.kgd.payment.application.payment.service.PaymentVoidExecutor
import com.kgd.payment.application.payment.service.ReconciliationService
import com.kgd.payment.application.payment.service.ReconciliationTransactionalService
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.springframework.beans.factory.support.StaticListableBeanFactory
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * 대사 정산일 경계 — KST 자정 직전 매입. 결제 행과 모의 PG 원장이 **같은 매입 시각**을 가져야 두 날짜 어느 쪽에서도 불일치가 없다.
 *
 * 실제 [MockPgAdapter](원장 쓰기·정산 파일) + 실제 결제 명령·대사 서비스를 태우고, 원장 저장소만 메모리로 둔다.
 * 시계는 읽을 때마다 1ms 씩 간다 — 두 기록이 시계를 따로 읽으면 23:59:59.999 와 00:00:00.000 으로 갈라진다.
 * 판정 근거: 대사 결과(불일치 수)와 운영 이슈 행.
 */
class MockPgReconciliationBoundaryTest : BehaviorSpec({

    val kst = ZoneId.of("Asia/Seoul")
    val settleDate = java.time.LocalDate.parse("2026-09-24")
    val lastMs: Instant = LocalDateTime.parse("2026-09-24T23:59:59.999").atZone(kst).toInstant()

    given("KST 23:59:59.999 에 매입된 결제") {
        then("결제 행과 PG 원장의 매입 시각이 같고, 그날·다음 날 대사 어느 쪽도 불일치가 없다") {
            val clock = TickingClock(lastMs.minusSeconds(60))
            val ledger = InMemoryLedger()
            val pg = MockPgAdapter(
                ledger.repository,
                StaticListableBeanFactory().getBeanProvider(MockPgScenario::class.java),
                MockPgCallRecorder(),
                clock,
            )
            val payments = InMemoryPayments()
            val opsIssues = InMemoryOpsIssues()
            val events = mockk<PaymentEventPort>(relaxed = true)
            val tx = PaymentTransactionalService(payments, InMemoryRefunds(), opsIssues, events, clock)
            val commands = PaymentCommandService(payments, InMemoryRefunds(), pg, tx, PaymentVoidExecutor(pg, tx), clock)
            val reconciliations = InMemoryReconciliations()
            val recon = ReconciliationService(
                payments, pg, ReconciliationTransactionalService(reconciliations, opsIssues, events, clock), reconciliations, clock,
            )

            commands.authorize(ProcessPaymentCommandUseCase.Authorize(1L, "ORD-1-1", 10_000L))
            clock.now = lastMs
            commands.capture("ORD-1-1")

            recon.reconcile(settleDate) shouldBe ReconcilePaymentsUseCase.Result(matched = 1, mismatched = 0, skipped = 0)
            recon.reconcile(settleDate.plusDays(1)) shouldBe ReconcilePaymentsUseCase.Result(matched = 0, mismatched = 0, skipped = 0)
            opsIssues.rows.values.toList().shouldBeEmpty()

            val row = payments.findByOrderNo("ORD-1-1")!!
            row.capturedAt shouldBe lastMs
            ledger.rows.single().capturedAt shouldBe row.capturedAt
        }
    }
}) {
    /** 읽을 때마다 1ms 씩 가는 시계 */
    class TickingClock(var now: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = now.also { now = now.plusMillis(1) }
    }

    /** 모의 PG 원장 저장소의 메모리 구현 — 정산 파일 조회는 SQL 과 같은 반열림 구간 [from, to) */
    class InMemoryLedger {
        val rows = mutableListOf<MockPgTransactionJpaEntity>()
        val repository: MockPgTransactionJpaRepository = mockk<MockPgTransactionJpaRepository>().also { repo ->
            every { repo.findByOrderNo(any()) } answers { rows.firstOrNull { it.orderNo == firstArg<String>() } }
            every { repo.findByPaymentKey(any()) } answers { rows.firstOrNull { it.paymentKey == firstArg<String>() } }
            every { repo.save(any<MockPgTransactionJpaEntity>()) } answers {
                firstArg<MockPgTransactionJpaEntity>().also { if (rows.none { r -> r === it }) rows += it }
            }
            every { repo.findAllByStatusAndCapturedAtGreaterThanEqualAndCapturedAtLessThanOrderByIdAsc(any(), any(), any()) } answers {
                val status = firstArg<MockPgTxStatus>()
                val from = secondArg<Instant>()
                val to = thirdArg<Instant>()
                rows.filter { it.status == status && it.capturedAt?.let { t -> !t.isBefore(from) && t.isBefore(to) } == true }
            }
        }
    }
}
