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
})
