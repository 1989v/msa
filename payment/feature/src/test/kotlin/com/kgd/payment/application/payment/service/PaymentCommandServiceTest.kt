package com.kgd.payment.application.payment.service

import com.kgd.payment.application.payment.port.PaymentEventType
import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.domain.payment.exception.RefundExceedsCapturedException
import com.kgd.payment.domain.payment.model.PaymentStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.just
import io.mockk.runs
import io.mockk.verify

/**
 * 결제 명령 처리 — 실제 서비스·도메인에 저장소는 메모리, PG·이벤트는 목.
 * 판정 근거는 PG 호출 횟수와 저장된 결제 행이다.
 */
class PaymentCommandServiceTest : BehaviorSpec({

    val authorize = ProcessPaymentCommandUseCase.Authorize(orderId = 100L, orderNo = "ORD-100-1", amount = 10_000L)

    given("같은 orderNo 로 승인 명령이 두 번 온다 (재배달)") {
        then("PG 승인은 한 번만 부르고 결제 행은 하나, authorized 이벤트도 하나다") {
            val h = PaymentHarness()
            every { h.pg.authorize("ORD-100-1", 10_000L) } returns PgResult.Approved("pk-1")

            h.commands.authorize(authorize).status shouldBe PaymentStatus.AUTHORIZED
            h.commands.authorize(authorize).status shouldBe PaymentStatus.AUTHORIZED

            verify(exactly = 1) { h.pg.authorize(any(), any()) }
            h.payments.rows.size shouldBe 1
            h.payments.rows.values.single().paymentKey shouldBe "pk-1"
            verify(exactly = 1) { h.events.publish(PaymentEventType.AUTHORIZED, any(), any(), any()) }
        }
    }

    given("PG 가 타임아웃으로 답한다") {
        then("UNKNOWN + unknown 이벤트, 30초 뒤 재조회가 잡힌다") {
            val h = PaymentHarness()
            every { h.pg.authorize(any(), any()) } returns PgResult.Unknown("TIMEOUT")

            h.commands.authorize(authorize).status shouldBe PaymentStatus.UNKNOWN

            val row = h.payments.rows.values.single()
            row.nextInquiryAt shouldBe T0.plusSeconds(30)
            verify(exactly = 1) { h.events.publish(PaymentEventType.UNKNOWN, any(), "TIMEOUT", any()) }
        }
    }

    given("토스 흐름 — 명령에 paymentKey 가 있다") {
        then("서버 승인이 아니라 승인 확인(confirm)을 부른다") {
            val h = PaymentHarness()
            every { h.pg.confirm("tpk", "ORD-100-1", 10_000L) } returns PgResult.Approved("tpk")

            h.commands.authorize(authorize.copy(paymentKey = "tpk")).status shouldBe PaymentStatus.AUTHORIZED

            verify(exactly = 0) { h.pg.authorize(any(), any()) }
        }
    }

    given("환불") {
        fun captured(h: PaymentHarness) {
            every { h.pg.authorize(any(), any()) } returns PgResult.Approved("pk-1")
            every { h.pg.capture(any(), any()) } just runs
            every { h.pg.refund(any(), any(), any(), any()) } just runs
            h.commands.authorize(authorize)
            h.commands.capture("ORD-100-1").status shouldBe PaymentStatus.CAPTURED
        }

        then("환불 합이 매입액을 넘으면 PG 를 부르기 전에 거부한다") {
            val h = PaymentHarness()
            captured(h)
            h.commands.refund(ProcessPaymentCommandUseCase.Refund("ORD-100-1", 7_000L, "rf-1", "부분 취소"))

            shouldThrow<RefundExceedsCapturedException> {
                h.commands.refund(ProcessPaymentCommandUseCase.Refund("ORD-100-1", 3_001L, "rf-2", "부분 취소"))
            }
            verify(exactly = 1) { h.pg.refund(any(), any(), any(), any()) }
            h.payments.rows.values.single().refundedAmount shouldBe 7_000L
        }

        then("같은 refundKey 는 한 번만 환불한다") {
            val h = PaymentHarness()
            captured(h)
            val refund = ProcessPaymentCommandUseCase.Refund("ORD-100-1", 10_000L, "rf-1", "전체 취소")

            h.commands.refund(refund).status shouldBe PaymentStatus.REFUNDED
            h.commands.refund(refund).status shouldBe PaymentStatus.REFUNDED

            verify(exactly = 1) { h.pg.refund("pk-1", 10_000L, "rf-1", "전체 취소") }
            h.refunds.rows.size shouldBe 1
        }
    }
})
