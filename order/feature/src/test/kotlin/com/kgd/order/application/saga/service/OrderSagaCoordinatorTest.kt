package com.kgd.order.application.saga.service

import com.kgd.order.application.saga.port.SagaCommand
import com.kgd.order.application.saga.usecase.InventoryAnswer
import com.kgd.order.application.saga.usecase.InventoryAnswerType
import com.kgd.order.application.saga.usecase.PaymentOutcome
import com.kgd.order.application.saga.usecase.PaymentOutcomeType
import com.kgd.order.application.saga.usecase.PromotionAnswer
import com.kgd.order.application.saga.usecase.PromotionAnswerType
import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.opsissue.model.OpsIssueType
import com.kgd.order.domain.order.exception.OrderCancelNotAllowedException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderFailureReason
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.saga.model.ReservedLine
import com.kgd.order.domain.saga.model.SagaStatus
import com.kgd.order.domain.saga.model.SagaStep
import com.kgd.order.domain.saga.model.SagaTiming
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetLine
import com.kgd.order.domain.sheet.model.ShippingLine
import com.kgd.order.support.InMemorySagaWorld
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * 사가 코디네이터 분기 — 실제 코디네이터 + 트랜잭션을 흉내 내는 메모리 포트. 판정은 **나간 명령 목록**과 저장된 주문·사가 상태다.
 */
class OrderSagaCoordinatorTest : BehaviorSpec({

    val t0 = Instant.parse("2026-10-10T00:00:00Z")
    val timing = SagaTiming(Duration.ofSeconds(60), Duration.ofMinutes(10), 10)

    class MutableClock(var now: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = now
    }

    class Fixture(zeroWon: Boolean = false) {
        val world = InMemorySagaWorld()
        val clock = MutableClock(t0)
        val coordinator = OrderSagaCoordinator(
            world.orders, world.sagas, world.commandPort, world.events, world.opsIssues, clock, timing, world.transactionManager,
        )
        val orderId: Long

        init {
            val price = if (zeroWon) 0L else 10_000L
            val sheet = OrderSheet.restore(
                id = 50L, memberId = "m-1",
                lines = listOf(
                    OrderSheetLine(1, 101L, "머그", 7L, price, 2, if (zeroWon) 0 else 2_000, CouponBearer.SELLER.takeIf { !zeroWon }, if (zeroWon) 0 else 1_000, 1_200),
                    OrderSheetLine(2, 102L, "컵", 1L, price, 1, 0, null, 0, 0),
                ),
                shippingLines = listOf(ShippingLine(7L, if (zeroWon) 0 else 3_000), ShippingLine(1L, 0)),
                userCouponId = if (zeroWon) null else 900L, couponDefinitionId = null,
                status = com.kgd.order.domain.sheet.model.OrderSheetStatus.ACTIVE, usedOrderId = null,
                expiresAt = t0.plusSeconds(900), createdAt = t0,
            )
            val saved = world.orders.save(Order.place("m-1", sheet, t0, ZoneOffset.UTC))
            orderId = requireNotNull(saved.id)
            coordinator.start(saved)
        }

        fun inv(type: InventoryAnswerType, command: String?, reason: String? = null, lines: List<ReservedLine> = LINES) =
            coordinator.onInventory(InventoryAnswer(orderId, type, command, reason, lines))
        fun promo(type: PromotionAnswerType, command: String?, reason: String? = null) =
            coordinator.onPromotion(PromotionAnswer(orderId, type, command, reason))
        fun pay(type: PaymentOutcomeType, reason: String? = null) = coordinator.onPayment(PaymentOutcome(orderId, type, reason))

        /** 결제 승인까지 */
        fun toAuthorize() {
            inv(InventoryAnswerType.RESERVED, "RESERVE")
            promo(PromotionAnswerType.RESERVED, "RESERVE")
        }

        fun toPaid() {
            toAuthorize()
            pay(PaymentOutcomeType.AUTHORIZED)
        }

        fun commandTypes() = world.commands.map { it::class.simpleName }
        fun order() = world.order(orderId)
        fun saga() = world.saga(orderId)
        fun deadline() { clock.now = saga().nextDeadlineAt; coordinator.onDeadline(orderId) }
    }

    given("정상 경로") {
        val f = Fixture()
        then("접수 → 재고 예약 명령(상품별 합산), 사가 RUNNING") {
            f.world.commands.single() shouldBe SagaCommand.ReserveInventory(
                f.orderId, listOf(SagaCommand.StockLine(101L, 2), SagaCommand.StockLine(102L, 1)),
            )
            f.saga().step shouldBe SagaStep.INVENTORY_RESERVE
        }
        then("재고 예약 → 혜택 예약(쿠폰·포인트·판매자 금액) → PAYMENT_PENDING + 결제 승인(결제액)") {
            f.toAuthorize()
            f.world.commands[1] shouldBe SagaCommand.ReservePromotion(
                f.orderId, "m-1", 900L, 2_000L, 1_000L,
                listOf(SagaCommand.SellerAmount(7L, 20_000L), SagaCommand.SellerAmount(1L, 10_000L)),
            )
            f.world.commands[2] shouldBe SagaCommand.AuthorizePayment(f.orderId, "ORD-${f.orderId}-1", 30_000L)
            f.order().status shouldBe OrderStatus.PAYMENT_PENDING
        }
        then("승인 → PAID + 재고 확정 → 혜택 확정 → 매입 (순서대로 하나씩)") {
            f.pay(PaymentOutcomeType.AUTHORIZED)
            f.order().status shouldBe OrderStatus.PAID
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.ConfirmInventory>()
            f.inv(InventoryAnswerType.CONFIRMED, "CONFIRM")
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.ConfirmPromotion>()
            f.promo(PromotionAnswerType.CONFIRMED, "CONFIRM")
            f.world.commands.last() shouldBe SagaCommand.CapturePayment(f.orderId, "ORD-${f.orderId}-1")
        }
        then("매입 → CONFIRMED + order.order.confirmed(라인·배송비) + 이행 생성(확정 라인의 창고)") {
            f.pay(PaymentOutcomeType.CAPTURED)
            f.order().status shouldBe OrderStatus.CONFIRMED
            f.world.commands.last() shouldBe SagaCommand.CreateFulfillment(f.orderId, LINES)
            f.world.confirmedEvents.single().let {
                it.items.map { l -> l.sellerId } shouldContainExactly listOf(7L, 1L)
                it.shippingLines shouldContainExactly listOf(ShippingLine(7L, 3_000), ShippingLine(1L, 0))
            }
        }
        then("이행 생성 → FULFILLING, 사가 COMPLETED · 이력은 전이마다 한 줄") {
            f.coordinator.onFulfillmentCreated(f.orderId)
            f.order().status shouldBe OrderStatus.FULFILLING
            f.saga().status shouldBe SagaStatus.COMPLETED
            f.world.history.map { it.second.from to it.second.to } shouldContainExactly listOf(
                null to OrderStatus.CREATED,
                OrderStatus.CREATED to OrderStatus.PAYMENT_PENDING,
                OrderStatus.PAYMENT_PENDING to OrderStatus.PAID,
                OrderStatus.PAID to OrderStatus.CONFIRMED,
                OrderStatus.CONFIRMED to OrderStatus.FULFILLING,
            )
        }
        then("같은 답이 다시 와도(재발행 명령에 대한 처음 답) 명령이 늘지 않는다") {
            val before = f.world.commands.size
            f.inv(InventoryAnswerType.RESERVED, "RESERVE")
            f.promo(PromotionAnswerType.CONFIRMED, "CONFIRM")
            f.pay(PaymentOutcomeType.CAPTURED)
            f.world.commands.size shouldBe before
        }
    }

    given("피벗 전 실패") {
        then("재고 부족 → 결제 명령 없이 FAILED(INSUFFICIENT_STOCK), 보상 명령도 없다") {
            val f = Fixture()
            f.inv(InventoryAnswerType.FAILED, "RESERVE", "INSUFFICIENT_STOCK", emptyList())
            f.commandTypes() shouldContainExactly listOf("ReserveInventory")
            f.order().status shouldBe OrderStatus.FAILED
            f.order().failureReason shouldBe OrderFailureReason.INSUFFICIENT_STOCK
            f.saga().status shouldBe SagaStatus.FAILED
        }
        then("혜택 실패 → 재고 해제 → 해제 답 뒤 FAILED(BENEFIT_UNAVAILABLE)") {
            val f = Fixture()
            f.inv(InventoryAnswerType.RESERVED, "RESERVE")
            f.promo(PromotionAnswerType.FAILED, "RESERVE", "DISCOUNT_MISMATCH")
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.ReleaseInventory>()
            f.order().status shouldBe OrderStatus.CREATED
            f.inv(InventoryAnswerType.RELEASED, "RELEASE", lines = emptyList())
            f.order().status shouldBe OrderStatus.FAILED
            f.order().failureReason shouldBe OrderFailureReason.BENEFIT_UNAVAILABLE
            f.world.commands.none { it is SagaCommand.AuthorizePayment } shouldBe true
        }
        then("결제 거절 → 혜택 취소 → 재고 해제 → FAILED(PAYMENT_DECLINED), VOID 없음") {
            val f = Fixture()
            f.toAuthorize()
            f.pay(PaymentOutcomeType.FAILED, "DECLINED")
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.CancelPromotion>()
            f.promo(PromotionAnswerType.CANCELLED, "CANCEL")
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.ReleaseInventory>()
            f.inv(InventoryAnswerType.RELEASED, "RELEASE", lines = emptyList())
            f.order().status shouldBe OrderStatus.FAILED
            f.order().failureReason shouldBe OrderFailureReason.PAYMENT_DECLINED
            f.world.commands.none { it is SagaCommand.VoidPayment } shouldBe true
        }
    }

    given("결제 결과 미상") {
        then("UNKNOWN 이면 기한이 30분 지나도 명령 없이 기다린다 — 주문은 PAYMENT_PENDING") {
            val f = Fixture()
            f.toAuthorize()
            f.pay(PaymentOutcomeType.UNKNOWN, "TIMEOUT")
            val before = f.world.commands.size
            repeat(30) { f.deadline() }
            f.world.commands.size shouldBe before
            f.order().status shouldBe OrderStatus.PAYMENT_PENDING
            f.saga().status shouldBe SagaStatus.RUNNING
        }
    }

    given("보류 만료") {
        then("(a) 승인 뒤·재고 확정 뒤 혜택 만료 → VOID → 혜택 취소 → 재입고 → PAID → FAILED(HOLD_EXPIRED)") {
            val f = Fixture()
            f.toPaid()
            f.inv(InventoryAnswerType.CONFIRMED, "CONFIRM")
            f.promo(PromotionAnswerType.EXPIRED, "EXPIRE")
            f.world.commands.last() shouldBe SagaCommand.VoidPayment(f.orderId, "ORD-${f.orderId}-1")
            f.saga().pendingVoid shouldBe false
            f.pay(PaymentOutcomeType.VOIDED)
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.CancelPromotion>()
            f.promo(PromotionAnswerType.CANCELLED, "CANCEL")
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.RestockInventory>()
            f.inv(InventoryAnswerType.RESTOCKED, "RESTOCK")
            f.order().status shouldBe OrderStatus.FAILED
            f.order().failureReason shouldBe OrderFailureReason.HOLD_EXPIRED
            f.world.history.last().second.from shouldBe OrderStatus.PAID
            f.world.commands.none { it is SagaCommand.CapturePayment } shouldBe true
        }
        then("(a') 혜택 확정 뒤 재고 확정이 EXPIRED 로 거절 → VOID → 혜택 원복(전체) → 재고 해제") {
            val f = Fixture()
            f.toPaid()
            f.inv(InventoryAnswerType.FAILED, "CONFIRM", "EXPIRED", emptyList())
            f.pay(PaymentOutcomeType.VOIDED)
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.CancelPromotion>()
            // 혜택은 확정 전이라 취소 — 이미 확정됐다는 답이 오면 원복으로 바꾼다
            f.promo(PromotionAnswerType.FAILED, "CANCEL", "ALREADY_CONFIRMED")
            f.world.commands.last() shouldBe SagaCommand.RestorePromotion(f.orderId, "saga-undo:${f.orderId}", 1_000L, fullCancel = true)
            f.promo(PromotionAnswerType.RESTORED, "RESTORE")
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.ReleaseInventory>()
            f.inv(InventoryAnswerType.RELEASED, "RELEASE", lines = emptyList())
            f.order().status shouldBe OrderStatus.FAILED
        }
        then("(b) 결제 미상 중 재고 만료 → VOID 예약(pendingVoid) → 승인 결론은 PAID 로만 적고 확정 명령 없음 → voided 뒤 보상 → FAILED") {
            val f = Fixture()
            f.toAuthorize()
            f.pay(PaymentOutcomeType.UNKNOWN)
            f.inv(InventoryAnswerType.EXPIRED, null, lines = emptyList())
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.VoidPayment>()
            f.saga().pendingVoid shouldBe true
            f.inv(InventoryAnswerType.EXPIRED, null, lines = emptyList()) // 예약 행마다 한 번씩 온다
            f.world.commands.count { it is SagaCommand.VoidPayment } shouldBe 1

            f.pay(PaymentOutcomeType.AUTHORIZED)
            f.order().status shouldBe OrderStatus.PAID
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.VoidPayment>()
            f.world.commands.none { it is SagaCommand.ConfirmInventory || it is SagaCommand.CapturePayment } shouldBe true

            f.pay(PaymentOutcomeType.VOIDED)
            f.promo(PromotionAnswerType.CANCELLED, "CANCEL")
            f.inv(InventoryAnswerType.RELEASED, "RELEASE", lines = emptyList())
            f.order().status shouldBe OrderStatus.FAILED
            f.order().failureReason shouldBe OrderFailureReason.HOLD_EXPIRED
        }
        then("(b) 결론이 거절이면 VOID 를 더 내지 않고 보상 → PAYMENT_PENDING → FAILED") {
            val f = Fixture()
            f.toAuthorize()
            f.pay(PaymentOutcomeType.UNKNOWN)
            f.promo(PromotionAnswerType.EXPIRED, "EXPIRE")
            f.pay(PaymentOutcomeType.FAILED, "DECLINED")
            f.world.commands.count { it is SagaCommand.VoidPayment } shouldBe 1
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.CancelPromotion>()
            f.promo(PromotionAnswerType.CANCELLED, "CANCEL")
            f.inv(InventoryAnswerType.RELEASED, "RELEASE", lines = emptyList())
            f.order().status shouldBe OrderStatus.FAILED
            f.world.history.last().second.from shouldBe OrderStatus.PAYMENT_PENDING
        }
        then("VOID 예약 중 결제가 미상인 동안 기한은 VOID 를 다시 내되 STUCK 으로 가지 않는다") {
            val f = Fixture()
            f.toAuthorize()
            f.pay(PaymentOutcomeType.UNKNOWN)
            f.inv(InventoryAnswerType.EXPIRED, null, lines = emptyList())
            repeat(15) { f.deadline() }
            f.saga().status shouldBe SagaStatus.COMPENSATING
            f.world.issues.shouldBeEmpty()
        }
    }

    given("피벗 뒤") {
        then("매입 단계에서 보류 만료가 와도 보상하지 않는다(경로 닫힘) — 기한마다 매입만 재발행, 10회 뒤 STUCK + 운영 이슈") {
            val f = Fixture()
            f.toPaid()
            f.inv(InventoryAnswerType.CONFIRMED, "CONFIRM")
            f.promo(PromotionAnswerType.CONFIRMED, "CONFIRM")
            f.saga().step shouldBe SagaStep.PAYMENT_CAPTURE
            f.world.clearCommands()
            f.inv(InventoryAnswerType.EXPIRED, null, lines = emptyList())
            f.promo(PromotionAnswerType.EXPIRED, "EXPIRE")
            f.world.commands.shouldBeEmpty()

            repeat(10) { f.deadline() }
            f.commandTypes() shouldContainExactly List(10) { "CapturePayment" }
            f.deadline()
            f.saga().status shouldBe SagaStatus.STUCK
            f.world.issues.single().let { it.type shouldBe OpsIssueType.SAGA_STUCK; it.targetId shouldBe f.orderId.toString() }
            f.world.commands shouldHaveSize 10
            f.order().status shouldBe OrderStatus.PAID
        }
        then("피벗 전 10분 초과(재고 예약 무응답) → 재고 해제 후 FAILED(TIMEOUT)") {
            val f = Fixture()
            repeat(20) { if (f.saga().status == SagaStatus.RUNNING) f.deadline() }
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.ReleaseInventory>()
            f.saga().failureReason shouldBe OrderFailureReason.TIMEOUT
        }
    }

    given("0원 주문") {
        then("결제 단계를 건너뛴다 — 혜택 예약 → 재고 확정 → 혜택 확정 → CREATED → CONFIRMED + 이행") {
            val f = Fixture(zeroWon = true)
            f.inv(InventoryAnswerType.RESERVED, "RESERVE")
            f.promo(PromotionAnswerType.RESERVED, "RESERVE")
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.ConfirmInventory>()
            f.inv(InventoryAnswerType.CONFIRMED, "CONFIRM")
            f.promo(PromotionAnswerType.CONFIRMED, "CONFIRM")
            f.order().status shouldBe OrderStatus.CONFIRMED
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.CreateFulfillment>()
            f.world.commands.none { it is SagaCommand.AuthorizePayment || it is SagaCommand.CapturePayment } shouldBe true
            f.world.history.map { it.second.to } shouldContainExactly listOf(OrderStatus.CREATED, OrderStatus.CONFIRMED)
        }
    }

    given("구매자 취소") {
        then("PAYMENT_PENDING 이면 409 이고 보상 명령이 나가지 않는다") {
            val f = Fixture()
            f.toAuthorize()
            val before = f.world.commands.size
            shouldThrow<OrderCancelNotAllowedException> { f.coordinator.cancel("m-1", f.orderId) }
            f.world.commands.size shouldBe before
            f.order().status shouldBe OrderStatus.PAYMENT_PENDING
            f.saga().status shouldBe SagaStatus.RUNNING
        }
        then("CREATED(혜택 예약 중)이면 혜택 취소 → 재고 해제 → CANCELLED") {
            val f = Fixture()
            f.inv(InventoryAnswerType.RESERVED, "RESERVE")
            f.coordinator.cancel("m-1", f.orderId).sagaStatus shouldBe "COMPENSATING"
            f.world.commands.last().shouldBeInstanceOf<SagaCommand.CancelPromotion>()
            f.promo(PromotionAnswerType.RESERVED, "RESERVE") // 늦게 온 예약 답은 무시
            f.promo(PromotionAnswerType.CANCELLED, "CANCEL")
            f.inv(InventoryAnswerType.RELEASED, "RELEASE", lines = emptyList())
            f.order().status shouldBe OrderStatus.CANCELLED
            f.world.commands.none { it is SagaCommand.AuthorizePayment } shouldBe true
        }
    }

    given("동시 갱신") {
        then("사가 저장이 @Version 충돌하면 다시 읽어 한 번만 진행한다 — 명령은 한 번") {
            val f = Fixture()
            f.world.sagaConflicts = 2
            f.inv(InventoryAnswerType.RESERVED, "RESERVE")
            f.world.commands.count { it is SagaCommand.ReservePromotion } shouldBe 1
            f.saga().step shouldBe SagaStep.PROMOTION_RESERVE
        }
    }
}) {
    companion object {
        val LINES = listOf(ReservedLine(101L, 3L, 2), ReservedLine(102L, 3L, 1))
    }
}
