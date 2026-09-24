package com.kgd.order.domain.claim.model

import com.kgd.order.domain.claim.exception.InvalidClaimTransitionException
import com.kgd.order.domain.claim.model.ClaimFixtures.NOW
import com.kgd.order.domain.claim.model.ClaimFixtures.fulfillingOrder
import com.kgd.order.domain.saga.model.SagaTiming
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Duration

/** 클레임 상태·단계 (스펙 SR-2 클레임 표) */
class ClaimTest : BehaviorSpec({

    val timing = SagaTiming(Duration.ofSeconds(60), Duration.ofMinutes(10), 3)

    fun claim(lineNos: List<Int> = listOf(1)) =
        Claim.restore(
            10L, 1L, "m-1", 7L, lineNos, ClaimStatus.REQUESTED, ClaimStep.QUEUED, false, null, null, null, null, null,
            null, null, 0, null, false, NOW, 0L,
        )

    Given("이행이 있는 주문의 클레임") {
        When("이행이 cancelled 로 답한다") {
            val c = claim()
            c.start(fulfillmentExists = true, NOW, timing)
            c.step shouldBe ClaimStep.FULFILLMENT_CANCEL
            c.approveAutomatically()
            Then("자동 승인 → 재입고 → 혜택 원복 → 환불 → REFUNDED") {
                c.status shouldBe ClaimStatus.APPROVED
                c.beginRefund(ClaimRefundPlan.of(fulfillingOrder(), listOf(1), emptySet()), NOW, timing) shouldBe ClaimStep.INVENTORY_RESTOCK
                c.completeStep(ClaimStep.INVENTORY_RESTOCK, NOW, timing) shouldBe ClaimStep.PROMOTION_RESTORE
                c.completeStep(ClaimStep.PROMOTION_RESTORE, NOW, timing) shouldBe ClaimStep.PAYMENT_REFUND
                c.completeStep(ClaimStep.PAYMENT_REFUND, NOW, timing) shouldBe ClaimStep.DONE
                c.status shouldBe ClaimStatus.REFUNDED
                c.pgRefund shouldBe 17_000
            }
        }

        When("이행이 cancel-rejected(이미 출고)로 답한다") {
            val c = claim()
            c.start(fulfillmentExists = true, NOW, timing)
            c.awaitSeller()
            Then("REQUESTED 로 판매자 결정을 기다리고, 답을 기다리는 클레임이 아니다") {
                c.status shouldBe ClaimStatus.REQUESTED
                c.step shouldBe ClaimStep.SELLER_DECISION
                c.awaitingAnswer shouldBe false
            }
            Then("판매자 승인 → 재입고 없이 원복·환불") {
                c.approveBySeller("seller-7")
                c.goodsShipped shouldBe true
                c.step shouldBe ClaimStep.QUEUED
                c.beginRefund(ClaimRefundPlan.of(fulfillingOrder(), listOf(1), setOf(7L)), NOW, timing) shouldBe ClaimStep.PROMOTION_RESTORE
            }
        }

        When("판매자가 반려한다") {
            val c = claim()
            c.start(fulfillmentExists = true, NOW, timing)
            c.awaitSeller()
            c.rejectBySeller("seller-7", "이미 사용한 상품")
            Then("REJECTED — 더 진행하지 않는다") {
                c.status shouldBe ClaimStatus.REJECTED
                shouldThrow<InvalidClaimTransitionException> { c.approveBySeller("seller-7") }
            }
        }
    }

    Given("이행 생성 명령만 나간 주문(CONFIRMED)의 클레임") {
        Then("이행이 생길 때까지 기다렸다가 취소 명령으로 간다 — 먼저 환불하지 않는다") {
            val c = claim()
            c.start(fulfillmentExists = false, NOW, timing)
            c.step shouldBe ClaimStep.FULFILLMENT_WAIT
            shouldThrow<InvalidClaimTransitionException> { c.approveAutomatically() }
            c.fulfillmentCreated(NOW, timing)
            c.step shouldBe ClaimStep.FULFILLMENT_CANCEL
        }
    }

    Given("포인트로만 결제한 라인의 클레임") {
        Then("PG 환불 단계가 없다") {
            val c = claim()
            c.start(true, NOW, timing)
            c.approveAutomatically()
            c.beginRefund(ClaimRefundPlan.of(fulfillingOrder(pointOnly = true), listOf(1), emptySet()), NOW, timing)
            c.completeStep(ClaimStep.INVENTORY_RESTOCK, NOW, timing) shouldBe ClaimStep.PROMOTION_RESTORE
            c.completeStep(ClaimStep.PROMOTION_RESTORE, NOW, timing) shouldBe ClaimStep.DONE
            c.status shouldBe ClaimStatus.REFUNDED
        }
    }

    Given("답이 오지 않는 단계") {
        Then("기한마다 재발행하고, 한도를 넘으면 멈춘다") {
            val c = claim()
            c.start(true, NOW, timing)
            val later = NOW.plusSeconds(61)
            repeat(3) { i -> c.checkDeadline(later.plusSeconds(61L * i), timing) shouldBe ClaimDeadlineDecision.REISSUE }
            c.checkDeadline(later.plusSeconds(61L * 3), timing) shouldBe ClaimDeadlineDecision.STUCK
            c.awaitingAnswer shouldBe false
            c.checkDeadline(later.plusSeconds(61L * 9), timing) shouldBe ClaimDeadlineDecision.NOT_DUE
        }
    }
})
