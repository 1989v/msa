package com.kgd.order.domain.saga.model

import com.kgd.order.domain.order.model.OrderFailureReason
import com.kgd.order.domain.saga.exception.InvalidSagaTransitionException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.time.Duration
import java.time.Instant

/** 사가 상태 · 단계 · 기한 (스펙 SR-2 사가 표, SR-4) */
class OrderSagaTest : BehaviorSpec({

    val t0 = Instant.parse("2026-10-10T00:00:00Z")
    val timing = SagaTiming(stepTimeout = Duration.ofSeconds(60), prePivotBudget = Duration.ofMinutes(10), maxRetries = 10)

    fun saga(paymentRequired: Boolean = true) = OrderSaga.start(1L, "ORD-1-1", paymentRequired, t0, timing)

    given("사가 상태 전이표 (5 × 5)") {
        val allowed = setOf(
            SagaStatus.RUNNING to SagaStatus.COMPENSATING,
            SagaStatus.COMPENSATING to SagaStatus.FAILED,
            SagaStatus.RUNNING to SagaStatus.COMPLETED,
            SagaStatus.RUNNING to SagaStatus.STUCK,
            SagaStatus.STUCK to SagaStatus.RUNNING,
            // 보상 단계의 재시도 소진 · 운영자 재개 — 스펙 표에 없는 두 줄(open question 으로 보고)
            SagaStatus.COMPENSATING to SagaStatus.STUCK,
            SagaStatus.STUCK to SagaStatus.COMPENSATING,
        )
        then("표의 행만 canMoveTo 가 참이다") {
            SagaStatus.entries.forEach { from ->
                SagaStatus.entries.forEach { to -> from.canMoveTo(to) shouldBe ((from to to) in allowed) }
            }
        }
        then("종착(COMPLETED · FAILED)에서는 어떤 조작도 예외") {
            val done = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing)
                it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
                it.advance(SagaStep.INVENTORY_CONFIRM, t0, timing)
                it.advance(SagaStep.PROMOTION_CONFIRM, t0, timing)
                it.advance(SagaStep.PAYMENT_CAPTURE, t0, timing)
                it.advance(SagaStep.FULFILLMENT_CREATE, t0, timing)
                it.complete()
            }
            done.status shouldBe SagaStatus.COMPLETED
            shouldThrow<InvalidSagaTransitionException> { done.complete() }
            shouldThrow<InvalidSagaTransitionException> { done.failAt(OrderFailureReason.TIMEOUT, true, t0, timing) }
            val failed = saga().also { it.failAt(OrderFailureReason.INSUFFICIENT_STOCK, false, t0, timing) }
            failed.status shouldBe SagaStatus.FAILED
            shouldThrow<InvalidSagaTransitionException> { failed.nextCompensation(t0, timing) }
            shouldThrow<InvalidSagaTransitionException> { failed.resume(t0, timing) }
        }
    }

    given("정방향 단계") {
        then("뒤로 가거나 보상 단계로 advance 하면 예외, 0원은 결제 단계를 건너뛸 수 있다") {
            val s = saga()
            s.advance(SagaStep.PROMOTION_RESERVE, t0, timing)
            shouldThrow<InvalidSagaTransitionException> { s.advance(SagaStep.INVENTORY_RESERVE, t0, timing) }
            shouldThrow<InvalidSagaTransitionException> { s.advance(SagaStep.PAYMENT_VOID, t0, timing) }
            val zero = saga(paymentRequired = false)
            zero.advance(SagaStep.PROMOTION_RESERVE, t0, timing)
            zero.advance(SagaStep.INVENTORY_CONFIRM, t0, timing)
            zero.step shouldBe SagaStep.INVENTORY_CONFIRM
        }
        then("결제가 필요 없는 사가는 결제 단계로 갈 수 없다") {
            val zero = saga(paymentRequired = false)
            zero.advance(SagaStep.PROMOTION_RESERVE, t0, timing)
            shouldThrow<InvalidSagaTransitionException> { zero.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing) }
        }
    }

    given("보상 계획 — 이미 한 것을 역순으로") {
        then("재고 예약 실패 → 보상 없음 → 바로 FAILED") {
            val s = saga()
            s.failAt(OrderFailureReason.INSUFFICIENT_STOCK, includeCurrent = false, now = t0, timing = timing).shouldBeNull()
            s.status shouldBe SagaStatus.FAILED
            s.failureReason shouldBe OrderFailureReason.INSUFFICIENT_STOCK
        }
        then("혜택 예약 실패 → 재고 해제") {
            val s = saga().also { it.advance(SagaStep.PROMOTION_RESERVE, t0, timing) }
            s.failAt(OrderFailureReason.BENEFIT_UNAVAILABLE, false, t0, timing) shouldBe SagaStep.INVENTORY_RELEASE
            s.status shouldBe SagaStatus.COMPENSATING
            s.nextCompensation(t0, timing).shouldBeNull()
            s.status shouldBe SagaStatus.FAILED
        }
        then("결제 거절 → 혜택 원복 → 재고 해제 (VOID 없음)") {
            val s = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing); it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
            }
            s.failAt(OrderFailureReason.PAYMENT_DECLINED, false, t0, timing) shouldBe SagaStep.PROMOTION_CANCEL
            s.pendingVoid shouldBe false
            s.nextCompensation(t0, timing) shouldBe SagaStep.INVENTORY_RELEASE
            s.nextCompensation(t0, timing).shouldBeNull()
        }
        then("결제 결론 전 보류 만료 (b) → VOID 예약(pendingVoid) → 혜택 취소 → 재고 해제") {
            val s = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing); it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
            }
            s.failAt(OrderFailureReason.HOLD_EXPIRED, true, t0, timing) shouldBe SagaStep.PAYMENT_VOID
            s.pendingVoid shouldBe true
            s.nextCompensation(t0, timing) shouldBe SagaStep.PROMOTION_CANCEL
            s.nextCompensation(t0, timing) shouldBe SagaStep.INVENTORY_RELEASE
        }
        then("승인 뒤 재고 확정 후 혜택 만료 (a) → VOID → 혜택 취소 → 재입고") {
            val s = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing); it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
                it.advance(SagaStep.INVENTORY_CONFIRM, t0, timing)
                it.markInventoryConfirmed(listOf(ReservedLine(101L, 1L, 2)))
                it.advance(SagaStep.PROMOTION_CONFIRM, t0, timing)
            }
            s.failAt(OrderFailureReason.HOLD_EXPIRED, true, t0, timing) shouldBe SagaStep.PAYMENT_VOID
            s.pendingVoid shouldBe false
            s.nextCompensation(t0, timing) shouldBe SagaStep.PROMOTION_CANCEL
            s.nextCompensation(t0, timing) shouldBe SagaStep.INVENTORY_RESTOCK
        }
        then("보상 중 확정 사실이 늦게 오면 해제 → 재입고, 취소 → 원복으로 바뀐다") {
            val s = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing); it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
                it.advance(SagaStep.INVENTORY_CONFIRM, t0, timing)
            }
            s.failAt(OrderFailureReason.HOLD_EXPIRED, true, t0, timing)
            s.markPromotionConfirmed()
            s.switchCompensation(SagaStep.PROMOTION_CANCEL, SagaStep.PROMOTION_RESTORE, t0, timing) shouldBe false
            s.markInventoryConfirmed(listOf(ReservedLine(101L, 1L, 2)))
            s.switchCompensation(SagaStep.INVENTORY_RELEASE, SagaStep.INVENTORY_RESTOCK, t0, timing) shouldBe false
            s.nextCompensation(t0, timing) shouldBe SagaStep.PROMOTION_RESTORE
            // 되돌리는 방향(원복 → 취소)은 없다
            shouldThrow<IllegalArgumentException> {
                s.switchCompensation(SagaStep.PROMOTION_RESTORE, SagaStep.PROMOTION_CANCEL, t0, timing)
            }
            s.nextCompensation(t0, timing) shouldBe SagaStep.INVENTORY_RESTOCK
        }
    }

    given("기한") {
        then("기한 전에는 NOT_DUE, 지나면 재발행하며 시도 수가 는다 — 10회 뒤 STUCK") {
            val s = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing); it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
                it.advance(SagaStep.INVENTORY_CONFIRM, t0, timing)
            }
            s.checkDeadline(t0, timing) shouldBe DeadlineDecision.NOT_DUE
            var now = t0
            repeat(10) { i ->
                now = s.nextDeadlineAt
                s.checkDeadline(now, timing) shouldBe DeadlineDecision.REISSUE
                s.attempts shouldBe i + 1
            }
            s.checkDeadline(s.nextDeadlineAt, timing) shouldBe DeadlineDecision.STUCK
            s.status shouldBe SagaStatus.STUCK
            s.resume(now, timing)
            s.status shouldBe SagaStatus.RUNNING
            s.attempts shouldBe 0
        }
        then("피벗 전 10분이 지나면 PRE_PIVOT_EXPIRED, 결제 결과 미상이면 기다린다(WAIT)") {
            val s = saga().also { it.advance(SagaStep.PROMOTION_RESERVE, t0, timing) }
            s.checkDeadline(t0.plus(Duration.ofMinutes(10)), timing) shouldBe DeadlineDecision.PRE_PIVOT_EXPIRED
            val u = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing); it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
                it.markPaymentUnknown()
            }
            u.checkDeadline(t0.plus(Duration.ofMinutes(30)), timing) shouldBe DeadlineDecision.WAIT
            u.attempts shouldBe 0
            u.status shouldBe SagaStatus.RUNNING
        }
        then("VOID 예약 중 결제가 미상이면 VOID 를 다시 내되 시도 수는 세지 않는다") {
            val s = saga().also {
                it.advance(SagaStep.PROMOTION_RESERVE, t0, timing); it.advance(SagaStep.PAYMENT_AUTHORIZE, t0, timing)
                it.markPaymentUnknown()
                it.failAt(OrderFailureReason.HOLD_EXPIRED, true, t0, timing)
            }
            repeat(15) { s.checkDeadline(s.nextDeadlineAt, timing) shouldBe DeadlineDecision.REISSUE_WAITING }
            s.attempts shouldBe 0
            s.status shouldBe SagaStatus.COMPENSATING
        }
    }
})
