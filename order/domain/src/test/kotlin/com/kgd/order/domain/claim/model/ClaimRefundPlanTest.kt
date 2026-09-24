package com.kgd.order.domain.claim.model

import com.kgd.order.domain.claim.exception.ClaimNotAllowedException
import com.kgd.order.domain.claim.model.ClaimFixtures.NOW
import com.kgd.order.domain.claim.model.ClaimFixtures.fulfillingOrder
import com.kgd.order.domain.sheet.model.ShippingLine
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe

/** 클레임 환불 계산 (스펙 SR-8) — 판정은 계획이 내는 금액 값이다 */
class ClaimRefundPlanTest : BehaviorSpec({

    Given("판매자 둘 · 쿠폰 · 포인트 주문 (ClaimFixtures 표)") {
        When("라인 1만 부분 취소 — 판매자 7 에 라인 2 가 남는다") {
            val order = fulfillingOrder()
            val plan = ClaimRefundPlan.of(order, listOf(1), shippedSellers = emptySet())
            Then("환불액 = 라인 결제액 17,000, 포인트 안분 1,000 은 포인트로 원복") {
                plan.pgRefund shouldBe 17_000
                plan.pointRestore shouldBe 1_000
                // 돌려받는 값 = 판매가×수량 − 쿠폰 안분 = 18,000 이 포인트와 PG 로 나뉜다
                (plan.pgRefund + plan.pointRestore) shouldBe 20_000 - 2_000
            }
            Then("쿠폰은 유지 — 반환하지 않고 재계산도 없다, 배송비는 환불하지 않는다") {
                plan.couponReturn shouldBe false
                plan.fullCancel shouldBe false
                plan.shippingRefunds.shouldBeEmpty()
            }
        }

        When("판매자 7 의 라인 전부(1·2)를 출고 전 취소") {
            val order = fulfillingOrder()
            Then("판매자 7 배송비 3,000 도 환불한다") {
                val plan = ClaimRefundPlan.of(order, listOf(1, 2), shippedSellers = emptySet())
                plan.shippingRefunds shouldContainExactly listOf(ShippingLine(7L, 3_000))
                plan.pgRefund shouldBe 17_000 + 4_500 + 3_000
                plan.pointRestore shouldBe 1_500
            }
            Then("이미 출고된 판매자면 배송비는 유지한다") {
                ClaimRefundPlan.of(order, listOf(1, 2), shippedSellers = setOf(7L)).let {
                    it.shippingRefunds.shouldBeEmpty()
                    it.pgRefund shouldBe 17_000 + 4_500
                }
            }
        }

        When("라인 1이 앞서 취소된 뒤 라인 2를 취소 — 판매자 7 의 마지막 라인") {
            val order = fulfillingOrder()
            order.closeClaim(listOf(1), 17_000, "m-1", NOW)
            Then("이번 클레임에 판매자 7 배송비가 붙는다") {
                ClaimRefundPlan.of(order, listOf(2), shippedSellers = emptySet()).pgRefund shouldBe 4_500 + 3_000
            }
        }

        When("전체 취소") {
            val order = fulfillingOrder()
            val plan = ClaimRefundPlan.of(order, listOf(1, 2, 3), shippedSellers = emptySet())
            Then("쿠폰을 돌려주고, PG 환불 합 = 주문 결제액") {
                plan.fullCancel shouldBe true
                plan.couponReturn shouldBe true
                plan.pgRefund shouldBe order.payableAmount
                plan.pointRestore shouldBe order.pointAmount
            }
        }

        When("이미 취소된 라인을 다시 취소") {
            val order = fulfillingOrder()
            order.closeClaim(listOf(3), 7_000 + 2_500, "m-1", NOW)
            Then("409 성격의 예외") {
                shouldThrow<ClaimNotAllowedException> { ClaimRefundPlan.of(order, listOf(3), emptySet()) }
            }
        }
    }

    Given("포인트로만 결제한 라인") {
        Then("PG 환불 0 · 포인트 전액 원복") {
            val plan = ClaimRefundPlan.of(fulfillingOrder(pointOnly = true), listOf(1), emptySet())
            plan.pgRefund shouldBe 0
            plan.pointRestore shouldBe 10_000
        }
    }
})
