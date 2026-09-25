package com.kgd.order.application.order.service

import com.kgd.order.application.claim.service.ClaimCoordinator
import com.kgd.order.application.order.port.PurchaseConfirmTrigger
import com.kgd.order.domain.claim.exception.PurchaseConfirmNotAllowedException
import com.kgd.order.domain.order.model.OrderLineStatus
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.saga.model.SagaTiming
import com.kgd.order.domain.sheet.model.ShippingLine
import com.kgd.order.support.ClaimTestOrders
import com.kgd.order.support.InMemoryClaimPorts
import com.kgd.order.support.InMemoryOrderPorts
import com.kgd.order.support.InMemorySagaWorld
import com.kgd.order.support.InMemorySagaWorld.PurchaseConfirmedEvent
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/** 구매 확정 (스펙 SR-8) — 시계를 주입해 배송 완료 + 7일을 넘긴다. 판정은 `order.line.purchase-confirmed` 로 나간 값과 주문 상태 */
class PurchaseConfirmServiceTest : BehaviorSpec({

    val t0 = Instant.parse("2026-10-10T00:00:00Z")
    val timing = SagaTiming(Duration.ofSeconds(60), Duration.ofMinutes(10), 3)

    class MutableClock(var now: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = now
    }

    class Fixture {
        val world = InMemorySagaWorld()
        val claims = InMemoryClaimPorts()
        val clock = MutableClock(t0)
        val service = PurchaseConfirmService(world.orders, claims.repository, world.events, clock, 7, world.transactionManager)
        val coordinator = ClaimCoordinator(
            world.orders, claims.repository, InMemoryOrderPorts().sellers, claims.commandPort, world.events, world.opsIssues, clock,
            timing, world.transactionManager,
        )
        val orderId = ClaimTestOrders.place(world, t0)

        fun order() = world.order(orderId)
        fun sweep() = service.candidateOrderIds(10).forEach { service.autoConfirm(it) }
    }

    Given("판매자 7 상품만 배송 완료") {
        val f = Fixture()
        f.service.onDelivered(f.orderId, listOf(101L, 102L))

        When("7일이 지나기 전") {
            f.clock.now = t0.plus(Duration.ofDays(7)).minusSeconds(1)
            f.sweep()
            Then("확정하지 않는다") { f.world.purchaseConfirmedEvents.shouldBeEmpty() }
        }
        When("7일이 지난다") {
            f.clock.now = t0.plus(Duration.ofDays(7))
            f.sweep()
            Then("라인 1·2 확정 이벤트 — 판매자 7 의 첫 확정 라인(1)에 배송비 3,000, 주문은 라인 3 이 남아 FULFILLING") {
                f.world.purchaseConfirmedEvents shouldContainExactly listOf(
                    PurchaseConfirmedEvent(1, 7L, ShippingLine(7L, 3_000), PurchaseConfirmTrigger.AUTO),
                    PurchaseConfirmedEvent(2, 7L, null, PurchaseConfirmTrigger.AUTO),
                )
                f.order().status shouldBe OrderStatus.FULFILLING
            }
        }
    }

    Given("라인 3을 부분 취소(환불 완료)한 주문") {
        val f = Fixture()
        val claim = f.coordinator.request("m-1", f.orderId, listOf(3)).single()
        f.coordinator.onFulfillmentCancelled(f.orderId)
        f.coordinator.onInventoryRestocked(f.orderId, "claim:${claim.claimId}")
        f.coordinator.onPaymentRefunded(f.orderId)
        f.order().items.first { it.lineNo == 3 }.status shouldBe OrderLineStatus.CANCELLED

        When("구매자가 구매 확정 버튼을 누른다") {
            f.service.confirm("m-1", f.orderId) shouldContainExactly listOf(1, 2)
            Then("남은 라인이 전부 확정 → COMPLETED") {
                f.order().status shouldBe OrderStatus.COMPLETED
                f.world.purchaseConfirmedEvents.map { it.lineNo to it.trigger } shouldContainExactly
                    listOf(1 to PurchaseConfirmTrigger.BUYER, 2 to PurchaseConfirmTrigger.BUYER)
            }
        }
    }

    Given("진행 중 클레임이 있는 주문") {
        val f = Fixture()
        f.coordinator.request("m-1", f.orderId, listOf(3))
        f.service.onDelivered(f.orderId, listOf(101L, 102L, 103L))
        f.clock.now = t0.plus(Duration.ofDays(8))
        Then("버튼은 409, 자동 확정은 건너뛴다") {
            shouldThrow<PurchaseConfirmNotAllowedException> { f.service.confirm("m-1", f.orderId) }
            f.sweep()
            f.world.purchaseConfirmedEvents.shouldBeEmpty()
        }
    }
})
