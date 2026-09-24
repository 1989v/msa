package com.kgd.order.application.claim.service

import com.kgd.common.exception.ForbiddenException
import com.kgd.order.application.claim.port.ClaimCommand
import com.kgd.order.domain.catalog.model.SellerView
import com.kgd.order.domain.claim.exception.ClaimNotAllowedException
import com.kgd.order.domain.claim.exception.ClaimNotFoundException
import com.kgd.order.domain.claim.model.ClaimStatus
import com.kgd.order.domain.claim.model.ClaimStep
import com.kgd.order.domain.opsissue.model.OpsIssueType
import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.saga.model.SagaTiming
import com.kgd.order.support.ClaimTestOrders
import com.kgd.order.support.InMemoryClaimPorts
import com.kgd.order.support.InMemoryOrderPorts
import com.kgd.order.support.InMemorySagaWorld
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * 클레임 처리 (스펙 SR-8) — 실제 코디네이터 + 메모리 포트. 판정은 **나간 명령**(금액·키)과 저장된 주문·클레임 상태다.
 * 주문 표는 [ClaimTestOrders].
 */
class ClaimCoordinatorTest : BehaviorSpec({

    val t0 = Instant.parse("2026-10-10T00:00:00Z")
    val timing = SagaTiming(Duration.ofSeconds(60), Duration.ofMinutes(10), 2)

    class MutableClock(var now: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = now
    }

    class Fixture(fulfilling: Boolean = true) {
        val world = InMemorySagaWorld()
        val ports = InMemoryOrderPorts()
        val claims = InMemoryClaimPorts()
        val clock = MutableClock(t0)
        val coordinator = ClaimCoordinator(
            world.orders, claims.repository, ports.sellers, claims.commandPort, world.events, world.opsIssues, clock, timing,
            world.transactionManager,
        )
        val orderId = ClaimTestOrders.place(world, t0, fulfilling)

        init {
            ports.sellers.save(SellerView(7L, SellerView.ACTIVE, 1_000, 3_000, t0, memberId = "seller-7"))
            ports.sellers.save(SellerView(8L, SellerView.ACTIVE, 500, 2_500, t0, memberId = "seller-8"))
        }

        fun order() = world.order(orderId)
        fun lastCommand() = claims.commands.last()

        /** 출고 전 경로를 끝까지 — 이행 취소 → 재입고 → 원복 → 환불 답 */
        fun answerPreShipment(restockKey: String) {
            coordinator.onFulfillmentCancelled(orderId)
            coordinator.onInventoryRestocked(orderId, restockKey)
            coordinator.onPromotionRestored(orderId)
            coordinator.onPaymentRefunded(orderId)
        }
    }

    Given("이행 중 주문의 부분 취소 (라인 1)") {
        val f = Fixture()
        val claim = f.coordinator.request("m-1", f.orderId, listOf(1)).single()

        Then("이행 취소 명령(라인 1 의 상품)을 먼저 낸다") {
            claim.step shouldBe ClaimStep.FULFILLMENT_CANCEL.name
            f.lastCommand() shouldBe ClaimCommand.CancelFulfillment(f.orderId, listOf(101L))
        }
        When("이행이 cancelled 로 답한다 — 출고 전") {
            f.coordinator.onFulfillmentCancelled(f.orderId)
            Then("자동 승인 → 라인 지정 재입고(키 = 클레임)") {
                f.claims.claim(claim.claimId).status shouldBe ClaimStatus.APPROVED
                f.lastCommand() shouldBe ClaimCommand.RestockInventory(f.orderId, "claim:${claim.claimId}", listOf(ClaimCommand.Line(101L, 2)))
            }
            Then("재입고 → 포인트 1,000 원복(쿠폰 유지 — fullCancel=false) → PG 17,000 환불") {
                f.coordinator.onInventoryRestocked(f.orderId, "claim:${claim.claimId}")
                f.lastCommand() shouldBe ClaimCommand.RestorePromotion(f.orderId, "claim:${claim.claimId}", 1_000, fullCancel = false)
                f.coordinator.onPromotionRestored(f.orderId)
                f.lastCommand() shouldBe ClaimCommand.RefundPayment(f.orderId, "ORD-${f.orderId}-1", 17_000, "claim:${claim.claimId}")
            }
            Then("환불 답 → REFUNDED · 라인 1 CANCELLED · 환불 누계 17,000 · 주문은 FULFILLING 그대로 · 환불 이벤트") {
                f.coordinator.onPaymentRefunded(f.orderId)
                f.claims.claim(claim.claimId).status shouldBe ClaimStatus.REFUNDED
                f.order().items.first { it.lineNo == 1 }.status shouldBe OrderLineStatus.CANCELLED
                f.order().refundedAmount shouldBe 17_000
                f.order().status shouldBe OrderStatus.FULFILLING
                f.world.claimRefundedEvents.single().pgRefund shouldBe 17_000
            }
        }
    }

    Given("전체 취소 — 판매자 둘") {
        val f = Fixture()
        val created = f.coordinator.request("m-1", f.orderId, null)

        Then("판매자마다 한 건, 답을 기다리는 것은 하나뿐이고 나머지는 줄 선다") {
            created shouldHaveSize 2
            created.map { it.sellerId to it.step } shouldContainExactly listOf(7L to "FULFILLMENT_CANCEL", 8L to "QUEUED")
        }
        When("두 클레임이 차례로 출고 전 경로를 끝낸다") {
            f.answerPreShipment("claim:${created[0].claimId}")
            val first = f.claims.claim(created[0].claimId)
            Then("첫 클레임: 판매자 7 라인 전부 → 배송비 3,000 포함, 아직 전체 취소가 아니라 쿠폰 반환 없음") {
                first.pgRefund shouldBe 17_000 + 4_500 + 3_000
                first.fullCancel shouldBe false
            }
            f.answerPreShipment("claim:${created[1].claimId}")
            val second = f.claims.claim(created[1].claimId)
            Then("마지막 클레임에서 전체 취소 → 쿠폰 반환 요청(fullCancel=true), 주문 CANCELLED, 환불 합 = 결제액") {
                f.claims.commands.filterIsInstance<ClaimCommand.RestorePromotion>().map { it.fullCancel } shouldContainExactly listOf(false, true)
                second.pgRefund shouldBe 7_000 + 2_500
                f.order().status shouldBe OrderStatus.CANCELLED
                f.order().refundedAmount shouldBe f.order().payableAmount
            }
        }
    }

    Given("이미 출고된 라인의 취소") {
        val f = Fixture()
        val claim = f.coordinator.request("m-1", f.orderId, listOf(3)).single()
        f.coordinator.onFulfillmentCancelRejected(f.orderId)

        Then("REQUESTED 로 판매자 결정 대기 — 환불 명령이 나가지 않는다") {
            f.claims.claim(claim.claimId).let { it.status shouldBe ClaimStatus.REQUESTED; it.step shouldBe ClaimStep.SELLER_DECISION }
            f.claims.commands.filterIsInstance<ClaimCommand.RefundPayment>().shouldBeEmpty()
        }
        Then("다른 판매자는 결정할 수 없다(404), 판매자 행이 없으면 403") {
            shouldThrow<ClaimNotFoundException> { f.coordinator.approve("seller-7", claim.claimId) }
            shouldThrow<ForbiddenException> { f.coordinator.approve("nobody", claim.claimId) }
        }
        When("그 판매자가 승인한다 — 반품을 따로 받았다") {
            f.coordinator.approve("seller-8", claim.claimId)
            Then("재입고 없이 원복을 건너뛰고(포인트 0·부분 취소) 환불 7,000 — 출고돼 배송비는 돌려주지 않는다") {
                f.claims.commands.filterIsInstance<ClaimCommand.RestockInventory>().shouldBeEmpty()
                f.lastCommand() shouldBe ClaimCommand.RefundPayment(f.orderId, "ORD-${f.orderId}-1", 7_000, "claim:${claim.claimId}")
            }
        }
    }

    Given("출고된 라인의 취소를 판매자가 반려") {
        val f = Fixture()
        val claim = f.coordinator.request("m-1", f.orderId, listOf(3)).single()
        f.coordinator.onFulfillmentCancelRejected(f.orderId)
        f.coordinator.reject("seller-8", claim.claimId, "사용 흔적")
        Then("REJECTED — 라인은 ACTIVE 그대로, 다시 취소 요청할 수 있다") {
            f.claims.claim(claim.claimId).status shouldBe ClaimStatus.REJECTED
            f.order().items.first { it.lineNo == 3 }.status shouldBe OrderLineStatus.ACTIVE
            f.coordinator.request("m-1", f.orderId, listOf(3)) shouldHaveSize 1
        }
    }

    Given("이행 생성 명령만 나간 주문(CONFIRMED)") {
        val f = Fixture(fulfilling = false)
        val claim = f.coordinator.request("m-1", f.orderId, listOf(2)).single()
        Then("이행이 생길 때까지 명령 없이 기다린다") {
            claim.step shouldBe ClaimStep.FULFILLMENT_WAIT.name
            f.claims.commands.shouldBeEmpty()
        }
        Then("이행 생성 답 → 취소 명령") {
            f.coordinator.onFulfillmentCreated(f.orderId)
            f.lastCommand() shouldBe ClaimCommand.CancelFulfillment(f.orderId, listOf(102L))
        }
    }

    Given("받을 수 없는 요청") {
        val f = Fixture()
        f.coordinator.request("m-1", f.orderId, listOf(1))
        Then("남의 주문 404 · 진행 중 라인 409 · 결제 전 주문 409") {
            shouldThrow<com.kgd.order.domain.order.exception.OrderNotFoundException> { f.coordinator.request("m-2", f.orderId, listOf(2)) }
            shouldThrow<ClaimNotAllowedException> { f.coordinator.request("m-1", f.orderId, listOf(1)) }
        }
    }

    Given("답이 오지 않는 환불 단계") {
        val f = Fixture()
        val claim = f.coordinator.request("m-1", f.orderId, listOf(1)).single()
        f.coordinator.onFulfillmentCancelled(f.orderId)
        Then("기한마다 같은 재입고 명령을 다시 내고, 한도를 넘으면 운영 이슈") {
            repeat(timing.maxRetries) {
                f.clock.now = f.clock.now.plusSeconds(61)
                f.coordinator.onDeadline(f.orderId)
            }
            f.claims.commands.filterIsInstance<ClaimCommand.RestockInventory>() shouldHaveSize 1 + timing.maxRetries
            f.clock.now = f.clock.now.plusSeconds(61)
            f.coordinator.onDeadline(f.orderId)
            f.world.issues.single().let { it.type shouldBe OpsIssueType.CLAIM_STUCK; it.targetId shouldBe claim.claimId.toString() }
        }
    }
})
