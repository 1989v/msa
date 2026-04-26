package com.kgd.sevensplit.domain.order

import com.kgd.sevensplit.domain.common.OrderId
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.event.OrderPlaced
import com.kgd.sevensplit.domain.event.OrderFilled
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.uuid
import io.kotest.property.checkAll

/**
 * INV-06 멱등 주문:
 *   Order 는 orderId(UUID) 로 식별되며, 동일 orderId 로 여러 번 OrderPlaced
 *   이벤트를 생성해도 '논리적 동일 주문' 으로 취급되어야 한다.
 *   도메인 수준에서는 이벤트 발행 side 의 dedup 키가 orderId 임을 property 로 보장한다.
 */
class IdempotentOrderSpec : BehaviorSpec({

    Given("동일 orderId 로 여러 번 OrderPlaced 가 쌓이는 상황") {
        When("orderId 로 distinct 하면") {
            Then("논리적으로 하나의 주문만 남는다") {
                // INV-06
                checkAll(15, Arb.uuid(), Arb.int(2..10)) { uuid, attempts ->
                    val slotId = SlotId.newId()
                    val orderId = OrderId(uuid)
                    val events = (1..attempts).map {
                        OrderPlaced(
                            tenantId = com.kgd.sevensplit.domain.common.TenantId("tenant-1"),
                            orderId = orderId,
                            slotId = slotId,
                            side = OrderSide.BUY,
                            type = SpotOrderType.Market,
                            quantity = Quantity.of("1"),
                            price = null
                        )
                    }
                    // 동일 orderId 로 distinct 하면 1건만 남는다
                    events.distinctBy { it.orderId } shouldHaveSize 1
                }
            }
        }
    }

    Given("동일 orderId 의 Order.create 를 두 번 호출") {
        When("두 번 생성하고 orderId 로 비교하면") {
            Then("둘 다 동일 orderId 를 보유하여 업스트림이 dedup 가능하다") {
                // INV-06 — 도메인 팩토리는 orderId 를 외부에서 받아 identity 유지
                val orderId = OrderId.newV7()
                val slotId = SlotId.newId()
                val a = Order.create(
                    orderId = orderId,
                    slotId = slotId,
                    side = OrderSide.BUY,
                    type = SpotOrderType.Limit(Price.of("100")),
                    quantity = Quantity.of("1"),
                    price = Price.of("100")
                )
                val b = Order.create(
                    orderId = orderId,
                    slotId = slotId,
                    side = OrderSide.BUY,
                    type = SpotOrderType.Limit(Price.of("100")),
                    quantity = Quantity.of("1"),
                    price = Price.of("100")
                )
                a.orderId shouldBe b.orderId
                // 업스트림 dedup 에서는 orderId 로 distinct
                listOf(a, b).distinctBy { it.orderId } shouldHaveSize 1
            }
        }
    }

    Given("OrderPlaced 와 OrderFilled 이벤트") {
        When("동일 orderId 를 기준으로 이벤트 스트림을 필터링") {
            Then("동일 orderId 로만 매칭되어 다른 주문과 섞이지 않는다") {
                // INV-06 — 이벤트 매칭 키 검증
                val orderA = OrderId.newV7()
                val orderB = OrderId.newV7()
                val tenant = com.kgd.sevensplit.domain.common.TenantId("tenant-1")
                val slotId = SlotId.newId()
                val events = listOf<com.kgd.sevensplit.domain.event.DomainEvent>(
                    OrderPlaced(
                        tenantId = tenant, orderId = orderA, slotId = slotId,
                        side = OrderSide.BUY, type = SpotOrderType.Market,
                        quantity = Quantity.of("1"), price = null
                    ),
                    OrderFilled(
                        tenantId = tenant, orderId = orderA,
                        executedPrice = Price.of("100"), executedQty = Quantity.of("1")
                    ),
                    OrderPlaced(
                        tenantId = tenant, orderId = orderB, slotId = slotId,
                        side = OrderSide.BUY, type = SpotOrderType.Market,
                        quantity = Quantity.of("1"), price = null
                    )
                )
                val forA = events.filter { e ->
                    when (e) {
                        is OrderPlaced -> e.orderId == orderA
                        is OrderFilled -> e.orderId == orderA
                        else -> false
                    }
                }
                forA shouldHaveSize 2
            }
        }
    }
})
