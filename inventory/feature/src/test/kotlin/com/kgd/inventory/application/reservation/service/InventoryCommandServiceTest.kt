package com.kgd.inventory.application.reservation.service

import com.kgd.inventory.domain.inventory.model.Inventory
import com.kgd.inventory.domain.reservation.model.ReservationStatus
import com.kgd.inventory.infrastructure.messaging.InventoryCommandConsumer
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import java.util.UUID

/**
 * 재고 명령(`inventory.command.*`) — 컨슈머부터 실제 서비스·도메인까지. 멱등은 두 겹을 따로 본다:
 * 같은 eventId 재배달(처리 원장) · 같은 orderId 의 새 명령(답 원장 — 같은 답, 효과 없음).
 * DLT 로 가는지는 리스너가 예외를 던지느냐로 정해진다 — 그래서 업무상 실패의 판정 근거는 "예외 없음 + failed 답"이다.
 */
class InventoryCommandServiceTest : BehaviorSpec({

    fun harness() = InventoryCommandHarness(
        Inventory.restore(1L, 100L, 1L, 10, 0, 0L),
        Inventory.restore(2L, 200L, 1L, 5, 0, 0L),
    )

    given("reserve 명령") {
        then("같은 eventId 두 번은 한 번만 예약하고, 같은 orderId 의 새 명령에는 처음 답을 그대로 다시 낸다") {
            val h = harness()
            val eventId = UUID.randomUUID()
            val json = h.reserveJson(eventId, 7L, 100L to 3, 200L to 2)

            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, json))
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, json))
            h.events("inventory.reservation.reserved") shouldHaveSize 1

            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 7L, 100L to 3, 200L to 2)))

            h.reservations.rows shouldHaveSize 2
            h.inventory(100L).getAvailableQty() shouldBe 7
            h.inventory(100L).getReservedQty() shouldBe 3
            h.events("inventory.stock.reserved") shouldHaveSize 2
            val answers = h.events("inventory.reservation.reserved")
            answers shouldHaveSize 2
            answers[1].payload shouldBe answers[0].payload
            answers.map { it.partitionKey }.toSet() shouldBe setOf("7")
            h.objectMapper.readTree(answers[0].payload).let { p ->
                p["orderId"].asLong() shouldBe 7L
                val lines = (0 until p["lines"].size()).map { p["lines"][it] }
                lines.map { it["productId"].asLong() to it["warehouseId"].asLong() }.toSet() shouldBe
                    setOf(100L to 1L, 200L to 1L)
                lines.all { it["reservationId"].asLong() > 0 } shouldBe true
            }
        }

        then("재고가 모자라 실패한 주문은 재입고 뒤 같은 명령이 다시 와도 같은 실패로 답한다") {
            val h = harness()
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 8L, 200L to 6)))
            h.inventoryService.execute(com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase.Command(200L, 1L, 10))

            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 8L, 200L to 6)))

            h.reservations.rows.shouldBeEmpty()
            h.inventory(200L).getAvailableQty() shouldBe 15
            val failed = h.events("inventory.reservation.failed")
            failed shouldHaveSize 2
            failed.map { h.objectMapper.readTree(it.payload)["reason"].asText() }.toSet() shouldBe setOf("INSUFFICIENT_STOCK")
            h.events("inventory.reservation.reserved").shouldBeEmpty()
        }
    }

    given("confirm 명령") {
        then("ACTIVE → CONFIRMED + reserved_qty 차감 + stock.confirmed, 새 명령에는 같은 답만 다시 낸다") {
            val h = harness()
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 9L, 100L to 4)))

            h.consumer.onConfirm(h.record(InventoryCommandConsumer.CONFIRM, h.orderJson(UUID.randomUUID(), 9L)))
            h.consumer.onConfirm(h.record(InventoryCommandConsumer.CONFIRM, h.orderJson(UUID.randomUUID(), 9L)))

            h.reservations.rows.single().getStatus() shouldBe ReservationStatus.CONFIRMED
            h.inventory(100L).getReservedQty() shouldBe 0
            h.inventory(100L).getAvailableQty() shouldBe 6
            h.events("inventory.stock.confirmed") shouldHaveSize 1
            h.events("inventory.reservation.confirmed") shouldHaveSize 2
        }

        then("보류 기한이 지난 예약에 확정이 오면 예외 없이 failed(EXPIRED) — DLT 로 가지 않고 재고는 되돌아간다") {
            val h = harness()
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 10L, 100L to 4)))
            h.lapse(10L)

            shouldNotThrowAny {
                h.consumer.onConfirm(h.record(InventoryCommandConsumer.CONFIRM, h.orderJson(UUID.randomUUID(), 10L)))
            }

            h.objectMapper.readTree(h.events("inventory.reservation.failed").single().payload).let {
                it["reason"].asText() shouldBe "EXPIRED"
                it["command"].asText() shouldBe "CONFIRM"
            }
            h.events("inventory.reservation.failed").single().partitionKey shouldBe "10"
            h.events("inventory.reservation.confirmed").shouldBeEmpty()
            h.events("inventory.stock.confirmed").shouldBeEmpty()
            h.reservations.rows.single().getStatus() shouldBe ReservationStatus.EXPIRED
            h.inventory(100L).getAvailableQty() shouldBe 10
            h.inventory(100L).getReservedQty() shouldBe 0
            h.events("inventory.reservation.expired").single().partitionKey shouldBe "10"
        }

        then("스케줄러가 먼저 만료시킨 예약도 같은 답 — 만료 이벤트의 키는 orderId") {
            val h = harness()
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 11L, 100L to 4)))
            h.lapse(11L)
            h.expiry.execute() shouldBe 1

            h.consumer.onConfirm(h.record(InventoryCommandConsumer.CONFIRM, h.orderJson(UUID.randomUUID(), 11L)))

            h.objectMapper.readTree(h.events("inventory.reservation.failed").single().payload)["reason"].asText() shouldBe "EXPIRED"
            h.inventory(100L).getAvailableQty() shouldBe 10
            h.events("inventory.reservation.expired").single().let {
                it.partitionKey shouldBe "11"
                h.objectMapper.readTree(it.payload)["orderId"].asLong() shouldBe 11L
            }
        }
    }

    given("release 명령") {
        then("ACTIVE 예약을 풀고 가용을 되돌리며, 새 명령에는 같은 답만 — 예약이 없던 주문에도 released 로 답한다") {
            val h = harness()
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 12L, 100L to 4)))

            h.consumer.onRelease(h.record(InventoryCommandConsumer.RELEASE, h.orderJson(UUID.randomUUID(), 12L)))
            h.consumer.onRelease(h.record(InventoryCommandConsumer.RELEASE, h.orderJson(UUID.randomUUID(), 12L)))
            h.consumer.onRelease(h.record(InventoryCommandConsumer.RELEASE, h.orderJson(UUID.randomUUID(), 99L)))

            h.reservations.rows.single().getStatus() shouldBe ReservationStatus.CANCELLED
            h.inventory(100L).getAvailableQty() shouldBe 10
            h.inventory(100L).getReservedQty() shouldBe 0
            h.events("inventory.stock.released") shouldHaveSize 1
            val released = h.events("inventory.reservation.released")
            released.map { it.partitionKey } shouldBe listOf("12", "12", "99")
            released[1].payload shouldBe released[0].payload
            h.objectMapper.readTree(released[2].payload)["lines"].size() shouldBe 0
        }

        then("이미 확정된 주문의 해제는 failed(ALREADY_CONFIRMED) — 확정 재고를 풀지 않는다") {
            val h = harness()
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 13L, 100L to 4)))
            h.consumer.onConfirm(h.record(InventoryCommandConsumer.CONFIRM, h.orderJson(UUID.randomUUID(), 13L)))

            h.consumer.onRelease(h.record(InventoryCommandConsumer.RELEASE, h.orderJson(UUID.randomUUID(), 13L)))

            h.objectMapper.readTree(h.events("inventory.reservation.failed").single().payload)["reason"].asText() shouldBe "ALREADY_CONFIRMED"
            h.inventory(100L).getAvailableQty() shouldBe 6
        }

        then("해제 답이 먼저 나간 주문에 예약 명령이 늦게 오면 failed(RELEASED) — 재고를 다시 잡지 않고, 재발행에도 같은 답") {
            val h = harness()
            h.consumer.onRelease(h.record(InventoryCommandConsumer.RELEASE, h.orderJson(UUID.randomUUID(), 15L)))

            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 15L, 100L to 4)))
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 15L, 100L to 4)))

            h.reservations.rows.shouldBeEmpty()
            h.inventory(100L).getAvailableQty() shouldBe 10
            h.inventory(100L).getReservedQty() shouldBe 0
            h.events("inventory.reservation.reserved").shouldBeEmpty()
            val failed = h.events("inventory.reservation.failed")
            failed shouldHaveSize 2
            failed.map { h.objectMapper.readTree(it.payload).let { p -> p["reason"].asText() to p["command"].asText() } }.toSet() shouldBe
                setOf("RELEASED" to "RESERVE")
            failed.map { it.partitionKey }.toSet() shouldBe setOf("15")
        }
    }

    given("restock 명령") {
        then("restockKey 별로 한 번만 가용을 되돌리고, 확정 수량을 넘는 요청은 효과 없이 failed(NOT_RESTOCKABLE)") {
            val h = harness()
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 14L, 100L to 5)))
            h.consumer.onConfirm(h.record(InventoryCommandConsumer.CONFIRM, h.orderJson(UUID.randomUUID(), 14L)))
            fun restock(key: String, qty: Int) = h.consumer.onRestock(
                h.record(
                    InventoryCommandConsumer.RESTOCK,
                    """{"eventId":"${UUID.randomUUID()}","orderId":14,"restockKey":"$key","lines":[{"productId":100,"quantity":$qty}]}""",
                ),
            )

            restock("claim-1", 2)
            restock("claim-1", 2)
            restock("claim-2", 3)
            restock("claim-3", 1)

            h.inventory(100L).getAvailableQty() shouldBe 10
            h.reservations.rows.single().getRestockedQty() shouldBe 5
            h.events("inventory.stock.restocked") shouldHaveSize 2
            h.events("inventory.reservation.restocked") shouldHaveSize 3
            h.objectMapper.readTree(h.events("inventory.reservation.failed").single().payload).let {
                it["reason"].asText() shouldBe "NOT_RESTOCKABLE"
                it["command"].asText() shouldBe "RESTOCK"
            }
        }

        then("라인을 지정했는데 restockKey 가 없으면 계약 위반 예외 — 이것만 DLT 로 간다") {
            val h = harness()
            shouldThrow<IllegalArgumentException> {
                h.consumer.onRestock(
                    h.record(InventoryCommandConsumer.RESTOCK, """{"orderId":14,"lines":[{"productId":100,"quantity":1}]}"""),
                )
            }
        }
    }

    given("옛 흐름 ACTIVE 예약 전환") {
        then("두 번 돌려도 수량은 한 번만 바뀌고, 사가가 예약한 주문은 건드리지 않는다") {
            val h = harness()
            h.seedLegacyActive(orderId = 500L, productId = 100L, qty = 3)
            h.seedLegacyActive(orderId = 501L, productId = 200L, qty = 2)
            h.consumer.onReserve(h.record(InventoryCommandConsumer.RESERVE, h.reserveJson(UUID.randomUUID(), 502L, 100L to 1)))

            h.conversion.convert() shouldBe 2
            h.conversion.convert() shouldBe null

            h.inventory(100L).getReservedQty() shouldBe 1 // 사가 예약 1 만 남는다
            h.inventory(100L).getAvailableQty() shouldBe 6
            h.inventory(200L).getReservedQty() shouldBe 0
            h.reservations.rows.filter { it.orderId in setOf(500L, 501L) }.map { it.getStatus() }.toSet() shouldBe
                setOf(ReservationStatus.CONFIRMED)
            h.reservations.rows.single { it.orderId == 502L }.getStatus() shouldBe ReservationStatus.ACTIVE
            h.events("inventory.stock.confirmed") shouldHaveSize 2
        }
    }
})
