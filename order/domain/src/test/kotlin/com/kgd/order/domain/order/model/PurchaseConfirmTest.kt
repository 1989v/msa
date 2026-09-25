package com.kgd.order.domain.order.model

import com.kgd.order.domain.claim.model.ClaimFixtures.NOW
import com.kgd.order.domain.claim.model.ClaimFixtures.fulfillingOrder
import com.kgd.order.domain.claim.model.ClaimRefundPlan
import com.kgd.order.domain.sheet.model.ShippingLine
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe

/** 구매 확정 (스펙 SR-8 · SR-9 배송비 라인 시점) */
class PurchaseConfirmTest : BehaviorSpec({

    Given("판매자 둘 · 라인 셋 주문 (ClaimFixtures 표)") {
        When("라인을 하나씩 확정한다") {
            val order = fulfillingOrder()
            Then("판매자의 첫 확정 라인에만 그 판매자 배송비 라인이 실리고, 마지막에 COMPLETED") {
                order.confirmPurchases(listOf(1), NOW).single().shipping shouldBe ShippingLine(7L, 3_000)
                order.confirmPurchases(listOf(2), NOW).single().shipping shouldBe null
                order.status shouldBe OrderStatus.FULFILLING
                order.confirmPurchases(listOf(3), NOW).single().shipping shouldBe ShippingLine(8L, 2_500)
                order.status shouldBe OrderStatus.COMPLETED
            }
        }

        When("라인 3을 부분 취소한 뒤 남은 라인을 한 번에 확정한다") {
            val order = fulfillingOrder()
            order.closeClaim(listOf(3), 7_000 + 2_500, "m-1", NOW)
            val confirmed = order.confirmPurchases(listOf(1, 2), NOW)
            Then("취소되지 않은 라인이 전부 확정 → COMPLETED, 배송비는 번호가 작은 라인 하나에만") {
                order.status shouldBe OrderStatus.COMPLETED
                order.refundedAmount shouldBe 9_500
                confirmed.map { it.line.lineNo to it.shipping } shouldContainExactly listOf(1 to ShippingLine(7L, 3_000), 2 to null)
            }
        }

        When("라인 1 확정 뒤 라인 2가 클레임으로 취소된다") {
            val order = fulfillingOrder()
            val first = order.confirmPurchases(listOf(1), NOW).single()
            Then("배송비는 이미 첫 확정 라인에 실렸고, 확정 라인이 있어 클레임은 배송비를 환불하지 않는다") {
                first.shipping shouldBe ShippingLine(7L, 3_000)
                ClaimRefundPlan.of(order, listOf(2), shippedSellers = emptySet()).shippingRefunds.shouldBeEmpty()
                order.closeClaim(listOf(2), 4_500, "m-1", NOW)
                order.items.first { it.lineNo == 2 }.status shouldBe OrderLineStatus.CANCELLED
            }
        }

        When("배송 완료 뒤 확정 기한") {
            val order = fulfillingOrder()
            order.markDelivered(listOf(101L, 102L), NOW)
            Then("기한(배송 완료 + N일) 이전 배송 완료된 ACTIVE 라인만 자동 확정 대상") {
                order.autoConfirmableLineNos(NOW.minusSeconds(1)).shouldBeEmpty()
                order.autoConfirmableLineNos(NOW) shouldContainExactly listOf(1, 2)
                order.items.first { it.lineNo == 1 }.shippedAt shouldBe NOW
            }
        }

        When("전체 라인이 클레임으로 취소된다") {
            val order = fulfillingOrder()
            order.closeClaim(listOf(1, 2, 3), order.payableAmount, "m-1", NOW)
            Then("CANCELLED · 환불 누계 = 결제액") {
                order.status shouldBe OrderStatus.CANCELLED
                order.refundedAmount shouldBe order.payableAmount
            }
        }
    }
})
