package com.kgd.fulfillment.domain.fulfillment.model

import com.kgd.fulfillment.domain.fulfillment.event.FulfillmentEvent
import com.kgd.fulfillment.domain.fulfillment.exception.InvalidFulfillmentStateException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class FulfillmentOrderTest : BehaviorSpec({

    given("풀필먼트 생성 시") {
        `when`("주문 ID와 창고 ID가 주어지면") {
            then("PENDING 상태의 풀필먼트가 생성된다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)

                order.getStatus() shouldBe FulfillmentStatus.PENDING
                order.orderId shouldBe 1L
                order.warehouseId shouldBe 100L
                order.id shouldBe null
            }
        }
    }

    given("상태 전이 시") {
        `when`("PENDING → PICKING") {
            then("성공하고 StatusChanged 이벤트를 반환한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)
                val event = order.transition(FulfillmentStatus.PICKING)

                order.getStatus() shouldBe FulfillmentStatus.PICKING
                event shouldBe FulfillmentEvent.StatusChanged(null, 1L, FulfillmentStatus.PENDING, FulfillmentStatus.PICKING)
            }
        }

        `when`("PENDING → PACKING") {
            then("InvalidFulfillmentStateException이 발생한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)

                shouldThrow<InvalidFulfillmentStateException> {
                    order.transition(FulfillmentStatus.PACKING)
                }
            }
        }

        `when`("PICKING → PACKING") {
            then("성공한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)
                order.transition(FulfillmentStatus.PICKING)
                val event = order.transition(FulfillmentStatus.PACKING)

                order.getStatus() shouldBe FulfillmentStatus.PACKING
                event shouldBe FulfillmentEvent.StatusChanged(null, 1L, FulfillmentStatus.PICKING, FulfillmentStatus.PACKING)
            }
        }

        `when`("PACKING → SHIPPED") {
            then("성공하고 Shipped 이벤트를 반환한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)
                order.transition(FulfillmentStatus.PICKING)
                order.transition(FulfillmentStatus.PACKING)
                val event = order.transition(FulfillmentStatus.SHIPPED)

                order.getStatus() shouldBe FulfillmentStatus.SHIPPED
                event shouldBe FulfillmentEvent.Shipped(null, 1L)
            }
        }

        `when`("SHIPPED → DELIVERED") {
            then("성공하고 Delivered 이벤트를 반환한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)
                order.transition(FulfillmentStatus.PICKING)
                order.transition(FulfillmentStatus.PACKING)
                order.transition(FulfillmentStatus.SHIPPED)
                val event = order.transition(FulfillmentStatus.DELIVERED)

                order.getStatus() shouldBe FulfillmentStatus.DELIVERED
                event shouldBe FulfillmentEvent.Delivered(null, 1L)
            }
        }

        `when`("DELIVERED → 어떤 상태든") {
            then("InvalidFulfillmentStateException이 발생한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)
                order.transition(FulfillmentStatus.PICKING)
                order.transition(FulfillmentStatus.PACKING)
                order.transition(FulfillmentStatus.SHIPPED)
                order.transition(FulfillmentStatus.DELIVERED)

                FulfillmentStatus.values().forEach { target ->
                    shouldThrow<InvalidFulfillmentStateException> {
                        order.transition(target)
                    }
                }
            }
        }
    }

    given("취소 시") {
        `when`("PENDING 상태면") {
            then("CANCELLED로 전환되고 Cancelled 이벤트를 반환한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)
                val event = order.cancel()

                order.getStatus() shouldBe FulfillmentStatus.CANCELLED
                event shouldBe FulfillmentEvent.Cancelled(null, 1L)
            }
        }

        `when`("DELIVERED 상태면") {
            then("InvalidFulfillmentStateException이 발생한다") {
                val order = FulfillmentOrder.create(orderId = 1L, warehouseId = 100L)
                order.transition(FulfillmentStatus.PICKING)
                order.transition(FulfillmentStatus.PACKING)
                order.transition(FulfillmentStatus.SHIPPED)
                order.transition(FulfillmentStatus.DELIVERED)

                shouldThrow<InvalidFulfillmentStateException> {
                    order.cancel()
                }
            }
        }
    }
    given("라인 취소 (클레임)") {
        // 주문 라인 101(상품 10)·102(상품 20)
        fun order() = FulfillmentOrder.create(
            orderId = 1L, warehouseId = 100L,
            lines = listOf(FulfillmentLine.create(101L, 10L, 2), FulfillmentLine.create(102L, 20L, 1)),
        )

        then("출고 전이면 지정한 라인만 취소되고, 마지막 라인까지 취소되면 이행 전체가 CANCELLED") {
            val order = order()
            order.transition(FulfillmentStatus.PICKING)

            val first = order.cancelLines(setOf(101L))
            (first as LineCancelResult.Cancelled).wholeCancelled shouldBe false
            order.getStatus() shouldBe FulfillmentStatus.PICKING
            order.getLines().map { it.productId to it.getStatus() }.toSet() shouldBe
                setOf(10L to FulfillmentLineStatus.CANCELLED, 20L to FulfillmentLineStatus.ACTIVE)

            val second = order.cancelLines(setOf(102L))
            (second as LineCancelResult.Cancelled).wholeCancelled shouldBe true
            order.getStatus() shouldBe FulfillmentStatus.CANCELLED
        }

        then("같은 상품이 두 주문 라인이면 주문 라인 id 로 하나만 취소된다") {
            val order = FulfillmentOrder.create(
                orderId = 1L, warehouseId = 100L,
                lines = listOf(FulfillmentLine.create(201L, 10L, 1), FulfillmentLine.create(202L, 10L, 3)),
            )
            order.cancelLines(setOf(202L))
            order.getLines().map { it.orderItemId to it.getStatus() } shouldBe
                listOf(201L to FulfillmentLineStatus.ACTIVE, 202L to FulfillmentLineStatus.CANCELLED)
            order.getStatus() shouldBe FulfillmentStatus.PENDING
        }

        then("이미 출고됐으면 거절하고 라인은 그대로다") {
            val order = order()
            order.transition(FulfillmentStatus.PICKING)
            order.transition(FulfillmentStatus.PACKING)
            order.transition(FulfillmentStatus.SHIPPED)

            order.cancelLines(setOf(101L)) shouldBe LineCancelResult.Rejected(FulfillmentStatus.SHIPPED)
            order.getLines().map { it.getStatus() }.toSet() shouldBe setOf(FulfillmentLineStatus.ACTIVE)
        }
    }
})
