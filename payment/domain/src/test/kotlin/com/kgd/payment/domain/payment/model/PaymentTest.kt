package com.kgd.payment.domain.payment.model

import com.kgd.payment.domain.payment.exception.InvalidPaymentStateException
import com.kgd.payment.domain.payment.exception.RefundExceedsCapturedException
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

class PaymentTest : BehaviorSpec({

    val t0 = Instant.parse("2026-09-24T00:00:00Z")

    fun payment(status: PaymentStatus, refunded: Long = 0L): Payment = Payment.restore(
        id = 1L,
        orderId = 100L,
        orderNo = "ORD-100-1",
        amount = 10_000L,
        paymentKey = if (status == PaymentStatus.READY || status == PaymentStatus.UNKNOWN) null else "pk",
        status = status,
        capturedAmount = if (status in setOf(PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED)) 10_000L else 0L,
        refundedAmount = refunded,
        voidRequestedAt = null,
        failureReason = null,
        inquiryAttempts = 0,
        nextInquiryAt = null,
        authorizedAt = null,
        capturedAt = null,
        createdAt = t0,
        updatedAt = t0,
    )

    // 스펙 SR-2 결제 전이표. 목표 상태마다 그 상태로 가는 도메인 메서드 하나.
    val actions: Map<PaymentStatus, (Payment) -> Unit> = mapOf(
        PaymentStatus.AUTHORIZED to { p -> p.authorize("pk", t0) },
        PaymentStatus.FAILED to { p -> p.fail("DECLINED", t0) },
        PaymentStatus.UNKNOWN to { p -> p.markUnknown("TIMEOUT", t0) },
        PaymentStatus.CAPTURED to { p -> p.capture(t0) },
        PaymentStatus.VOIDED to { p -> p.void(t0) },
        PaymentStatus.PARTIALLY_REFUNDED to { p -> p.refund(1_000L, t0) },
        PaymentStatus.REFUNDED to { p -> p.refund(p.refundableAmount, t0) },
    )
    val allowed = setOf(
        PaymentStatus.READY to PaymentStatus.AUTHORIZED,
        PaymentStatus.READY to PaymentStatus.FAILED,
        PaymentStatus.READY to PaymentStatus.UNKNOWN,
        PaymentStatus.UNKNOWN to PaymentStatus.AUTHORIZED,
        PaymentStatus.UNKNOWN to PaymentStatus.FAILED,
        PaymentStatus.AUTHORIZED to PaymentStatus.CAPTURED,
        PaymentStatus.AUTHORIZED to PaymentStatus.VOIDED,
        PaymentStatus.CAPTURED to PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.CAPTURED to PaymentStatus.REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED to PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED to PaymentStatus.REFUNDED,
    )

    given("결제 상태 전이표 (전수)") {
        PaymentStatus.entries.forEach { from ->
            actions.forEach { (to, act) ->
                val ok = (from to to) in allowed
                then("$from → $to 는 ${if (ok) "허용" else "금지"}") {
                    val p = payment(from, refunded = if (from == PaymentStatus.PARTIALLY_REFUNDED) 1_000L else 0L)
                    if (ok) {
                        shouldNotThrowAny { act(p) }
                        p.status shouldBe to
                    } else {
                        shouldThrow<InvalidPaymentStateException> { act(p) }
                        p.status shouldBe from
                    }
                }
            }
        }
        then("REFUNDED · VOIDED · FAILED 는 종착이다") {
            PaymentStatus.entries.filter { it.isTerminal }.toSet() shouldBe
                setOf(PaymentStatus.REFUNDED, PaymentStatus.VOIDED, PaymentStatus.FAILED)
        }
    }

    given("환불") {
        then("환불 합이 매입액을 넘으면 거부되고 상태·환불액이 그대로다") {
            val p = payment(PaymentStatus.CAPTURED)
            p.refund(6_000L, t0)
            shouldThrow<RefundExceedsCapturedException> { p.refund(4_001L, t0) }
            p.status shouldBe PaymentStatus.PARTIALLY_REFUNDED
            p.refundedAmount shouldBe 6_000L
        }
        then("부분 환불이 쌓여 매입액과 같아지면 REFUNDED") {
            val p = payment(PaymentStatus.CAPTURED)
            p.refund(6_000L, t0)
            p.status shouldBe PaymentStatus.PARTIALLY_REFUNDED
            p.refund(4_000L, t0)
            p.status shouldBe PaymentStatus.REFUNDED
            p.refundedAmount shouldBe 10_000L
        }
        then("0원 이하 환불은 받지 않는다") {
            shouldThrow<IllegalArgumentException> { payment(PaymentStatus.CAPTURED).refund(0L, t0) }
        }
    }

    given("결과 미상 결제의 VOID 요청 (보류 만료 규칙 b)") {
        then("UNKNOWN 이면 PG 를 부르지 않고 기억만 한다") {
            val p = payment(PaymentStatus.UNKNOWN)
            p.requestVoid(t0) shouldBe VoidDecision.DEFERRED
            p.status shouldBe PaymentStatus.UNKNOWN
            p.pendingVoidDue shouldBe false
        }
        then("기억된 VOID 는 AUTHORIZED 로 결론 나면 실행 대상이 된다") {
            val p = payment(PaymentStatus.UNKNOWN)
            p.requestVoid(t0)
            p.authorize("pk", t0)
            p.pendingVoidDue shouldBe true
        }
        then("FAILED 로 결론 나면 실행할 VOID 가 없다") {
            val p = payment(PaymentStatus.UNKNOWN)
            p.requestVoid(t0)
            p.fail("DECLINED", t0)
            p.pendingVoidDue shouldBe false
        }
        then("AUTHORIZED 면 바로 실행, 이미 VOIDED·FAILED 면 할 일 없음, 매입 뒤면 거부") {
            payment(PaymentStatus.AUTHORIZED).requestVoid(t0) shouldBe VoidDecision.EXECUTE
            payment(PaymentStatus.VOIDED).requestVoid(t0) shouldBe VoidDecision.ALREADY_SETTLED
            payment(PaymentStatus.FAILED).requestVoid(t0) shouldBe VoidDecision.ALREADY_SETTLED
            shouldThrow<InvalidPaymentStateException> { payment(PaymentStatus.CAPTURED).requestVoid(t0) }
        }
        then("VOID 가 기억된 결제는 매입하지 않는다") {
            val p = payment(PaymentStatus.UNKNOWN)
            p.requestVoid(t0)
            p.authorize("pk", t0)
            shouldThrow<InvalidPaymentStateException> { p.capture(t0) }
        }
    }

    given("UNKNOWN 재조회 백오프 30초 · 1분 · 2분 · 4분 · 2.5분") {
        then("다섯 번째 조회 실패에서 멈추고(다음 조회 없음) 소진을 알린다") {
            val p = payment(PaymentStatus.READY)
            p.markUnknown("TIMEOUT", t0)
            p.nextInquiryAt shouldBe t0.plusSeconds(30)

            var now = t0.plusSeconds(30)
            val gaps = mutableListOf<Duration>()
            repeat(4) {
                p.recordInquiryMiss(now) shouldBe false
                gaps += Duration.between(now, p.nextInquiryAt)
                now = p.nextInquiryAt!!
            }
            gaps shouldBe listOf(60L, 120L, 240L, 150L).map(Duration::ofSeconds)
            p.recordInquiryMiss(now) shouldBe true
            p.nextInquiryAt.shouldBeNull()
            p.inquiryAttempts shouldBe 5
            p.status shouldBe PaymentStatus.UNKNOWN
        }
        then("결론이 나면 다음 조회가 사라진다") {
            val p = payment(PaymentStatus.READY)
            p.markUnknown("TIMEOUT", t0)
            p.authorize("pk", t0)
            p.nextInquiryAt.shouldBeNull()
        }
    }

    given("새 결제") {
        then("READY 로 시작하고, 승인 호출 도중 죽어도 재조회가 줍도록 조회 시각을 갖는다") {
            val p = Payment.start(orderId = 1L, orderNo = "ORD-1-1", amount = 5_000L, now = t0)
            p.status shouldBe PaymentStatus.READY
            p.nextInquiryAt shouldBe t0.plusSeconds(30)
        }
        then("금액은 1원 이상") {
            shouldThrow<IllegalArgumentException> { Payment.start(1L, "ORD-1-1", 0L, t0) }
        }
    }
})
