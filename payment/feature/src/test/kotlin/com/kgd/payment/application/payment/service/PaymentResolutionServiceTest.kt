package com.kgd.payment.application.payment.service

import com.kgd.payment.application.payment.port.PaymentEventType
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.domain.opsissue.model.OpsIssueType
import com.kgd.payment.domain.payment.model.PaymentStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.just
import io.mockk.runs
import io.mockk.verify
import io.mockk.verifyOrder

/**
 * 결과 미상(UNKNOWN) 결제를 재조회로 결론 내기 · 보류 만료 규칙 (b).
 * 시계를 앞으로 돌려 재조회 스케줄 한 번씩을 흉내 낸다.
 */
class PaymentResolutionServiceTest : BehaviorSpec({

    val authorize = ProcessPaymentCommandUseCase.Authorize(orderId = 100L, orderNo = "ORD-100-1", amount = 10_000L)

    fun unknown(): PaymentHarness = PaymentHarness().also { h ->
        every { h.pg.authorize(any(), any()) } returns PgResult.Unknown("TIMEOUT")
        every { h.pg.void(any(), any()) } just runs
        h.commands.authorize(authorize)
    }

    fun PaymentHarness.tick(seconds: Long): Int {
        clock.now = clock.now.plusSeconds(seconds)
        return resolution.resolveDue()
    }

    given("UNKNOWN 결제") {
        then("30초 전에는 재조회하지 않고, 30초 뒤 재조회가 승인이면 AUTHORIZED + authorized 이벤트") {
            val h = unknown()
            every { h.pg.inquire("ORD-100-1") } returns PgInquiry.Approved("pk-9", 10_000L)

            h.tick(29) shouldBe 0
            verify(exactly = 0) { h.pg.inquire(any()) }
            h.tick(1) shouldBe 1

            val row = h.payments.rows.values.single()
            row.status shouldBe PaymentStatus.AUTHORIZED
            row.paymentKey shouldBe "pk-9"
            verify(exactly = 1) { h.events.publish(PaymentEventType.AUTHORIZED, any(), any(), any()) }
        }

        then("재조회 5회가 모두 미결이면 운영 이슈 1건을 남기고 멈춘다") {
            val h = unknown()
            every { h.pg.inquire(any()) } returns PgInquiry.Unavailable("PENDING")

            listOf(30L, 60L, 120L, 240L, 150L).forEach { h.tick(it) shouldBe 1 }
            h.tick(3_600) shouldBe 0

            verify(exactly = 5) { h.pg.inquire("ORD-100-1") }
            h.payments.rows.values.single().status shouldBe PaymentStatus.UNKNOWN
            h.opsIssues.rows.values.map { it.type to it.targetId } shouldBe
                listOf(OpsIssueType.PAYMENT_UNKNOWN to "ORD-100-1")
        }

        then("PG 금액이 우리 행과 다르면 승인으로 받지 않는다") {
            val h = unknown()
            every { h.pg.inquire(any()) } returns PgInquiry.Approved("pk-9", 1L)

            h.tick(30)

            h.payments.rows.values.single().status shouldBe PaymentStatus.UNKNOWN
        }
    }

    given("보류 만료 규칙 (b) — UNKNOWN 중에 VOID 명령이 온다") {
        then("그 자리에서는 PG 취소를 부르지 않고, 재조회가 AUTHORIZED 면 그때 취소해 VOIDED 로 끝난다") {
            val h = unknown()
            every { h.pg.inquire(any()) } returns PgInquiry.Approved("pk-9", 10_000L)

            h.commands.void("ORD-100-1").status shouldBe PaymentStatus.UNKNOWN
            verify(exactly = 0) { h.pg.void(any(), any()) }

            h.tick(30)

            verify(exactly = 1) { h.pg.void("pk-9", 10_000L) }
            h.payments.rows.values.single().status shouldBe PaymentStatus.VOIDED
            verify(exactly = 1) { h.events.publish(PaymentEventType.VOIDED, any(), any(), any()) }
        }

        then("재조회가 매입까지 끝난 승인(토스 DONE)이면 CAPTURED 로 기록한 뒤 그 VOID 를 전액 취소로 실행한다") {
            val h = unknown()
            every { h.pg.inquire(any()) } returns PgInquiry.Approved("tpk-9", 10_000L, captured = true)

            h.commands.void("ORD-100-1")
            h.tick(30)

            verify(exactly = 1) { h.pg.void("tpk-9", 10_000L) }
            h.payments.rows.values.single().let {
                it.status shouldBe PaymentStatus.REFUNDED
                it.capturedAmount shouldBe 10_000L
                it.refundedAmount shouldBe 10_000L
            }
            verifyOrder {
                h.events.publish(PaymentEventType.AUTHORIZED, any(), any(), any())
                h.events.publish(PaymentEventType.CAPTURED, any(), any(), any())
                h.events.publish(PaymentEventType.VOIDED, any(), any(), 10_000L)
            }
        }

        then("재조회가 거절이면 PG 취소는 0회, FAILED 로 끝난다") {
            val h = unknown()
            every { h.pg.inquire(any()) } returns PgInquiry.Declined("CARD_DECLINED")

            h.commands.void("ORD-100-1")
            h.tick(30)

            verify(exactly = 0) { h.pg.void(any(), any()) }
            h.payments.rows.values.single().status shouldBe PaymentStatus.FAILED
        }
    }
})
