package com.kgd.inventory.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.apache.kafka.clients.consumer.ConsumerRecord
import java.util.UUID

/**
 * ADR-0029 PR-8 / PR-8a (Phase 3) — 4 listeners 가 모두 common [IdempotentEventHandler] 로 이관됐다.
 *
 * - PR-8a: `onOrderCompleted` 도 [ReserveStockUseCase] 자연 멱등 보강(`InventoryService` pre-check)
 *   후 helper 로 이관.
 * - 헬퍼 mock 패턴: `process(eventId, consumerGroup)` 호출 시 lambda block 을 즉시 실행하도록 stub.
 *   멱등 skip 케이스는 block 미실행 stub 으로 표현.
 */
class InventoryEventConsumerTest : BehaviorSpec({
    val reserveStockUseCase = mockk<ReserveStockUseCase>()
    val confirmStockByOrderUseCase = mockk<ConfirmStockByOrderUseCase>()
    val releaseStockByOrderUseCase = mockk<ReleaseStockByOrderUseCase>()
    val objectMapper = ObjectMapper().apply { registerModule(JavaTimeModule()) }
    val idempotentEventHandler = mockk<IdempotentEventHandler>()
    val idempotentMetrics = mockk<IdempotentMetrics>(relaxed = true)

    val consumer = InventoryEventConsumer(
        reserveStockUseCase = reserveStockUseCase,
        confirmStockByOrderUseCase = confirmStockByOrderUseCase,
        releaseStockByOrderUseCase = releaseStockByOrderUseCase,
        objectMapper = objectMapper,
        idempotentEventHandler = idempotentEventHandler,
        idempotentMetrics = idempotentMetrics,
    )

    beforeEach {
        clearMocks(
            reserveStockUseCase,
            confirmStockByOrderUseCase,
            releaseStockByOrderUseCase,
            idempotentEventHandler,
            idempotentMetrics,
        )
    }

    val orderCompletedEventId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val emptyItemsEventId = UUID.fromString("55555555-5555-5555-5555-555555555555")
    val shippedEventId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    val cancelEventId = UUID.fromString("33333333-3333-3333-3333-333333333333")
    val orderCancelled1 = UUID.fromString("44444444-4444-4444-4444-444444444401")
    val orderCancelled2 = UUID.fromString("44444444-4444-4444-4444-444444444402")
    val orderCancelled3 = UUID.fromString("44444444-4444-4444-4444-444444444403")

    /** 헬퍼 mock — block 즉시 실행 + PROCESSED 반환 (신규 처리 정상 흐름). */
    fun stubProcessExecutes(eventId: UUID) {
        every {
            idempotentEventHandler.process(eq(eventId), eq("inventory-service"), any())
        } answers {
            thirdArg<() -> Unit>().invoke()
            IdempotentEventHandler.Outcome.PROCESSED
        }
    }

    /** 헬퍼 mock — block 미실행 + SKIPPED 반환 (이미 처리된 이벤트). */
    fun stubProcessSkips(eventId: UUID) {
        every {
            idempotentEventHandler.process(eq(eventId), eq("inventory-service"), any())
        } returns IdempotentEventHandler.Outcome.SKIPPED
    }

    given("order.order.completed 이벤트 수신 시 (PR-8a helper 이관 완료)") {
        val payload = """{"eventId":"$orderCompletedEventId","orderId":1,"userId":"user1","totalAmount":10000,"status":"COMPLETED","items":[{"productId":100,"quantity":2,"unitPrice":5000}],"eventTime":"2026-04-07T10:00:00"}"""

        `when`("새로운 eventId이면 (helper PROCESSED)") {
            then("재고 예약이 실행되고 helper.process 가 한 번 호출되어야 한다") {
                val record = ConsumerRecord("order.order.completed", 0, 0, "1", payload)

                stubProcessExecutes(orderCompletedEventId)
                every { reserveStockUseCase.execute(any()) } returns ReserveStockUseCase.Result(1L, 100L, 8, 2)

                consumer.onOrderCompleted(record)

                verify(exactly = 1) {
                    reserveStockUseCase.execute(match { it.orderId == 1L && it.productId == 100L && it.qty == 2 })
                }
                verify(exactly = 1) {
                    idempotentEventHandler.process(eq(orderCompletedEventId), eq("inventory-service"), any())
                }
            }
        }

        `when`("이미 처리된 eventId이면 (helper SKIPPED)") {
            then("재고 예약이 실행되지 않아야 한다 (멱등성)") {
                val record = ConsumerRecord("order.order.completed", 0, 0, "1", payload)

                stubProcessSkips(orderCompletedEventId)

                consumer.onOrderCompleted(record)

                verify(exactly = 0) { reserveStockUseCase.execute(any()) }
            }
        }

        `when`("items가 비어 있으면 (helper PROCESSED)") {
            then("예약 없이 처리가 완료되어야 한다") {
                val emptyItemsPayload = """{"eventId":"$emptyItemsEventId","orderId":2,"userId":"user1","totalAmount":0,"status":"COMPLETED","items":[],"eventTime":"2026-04-07T10:00:00"}"""
                val record = ConsumerRecord("order.order.completed", 0, 0, "2", emptyItemsPayload)

                stubProcessExecutes(emptyItemsEventId)

                consumer.onOrderCompleted(record)

                verify(exactly = 0) { reserveStockUseCase.execute(any()) }
                verify(exactly = 1) {
                    idempotentEventHandler.process(eq(emptyItemsEventId), eq("inventory-service"), any())
                }
            }
        }

        `when`("eventId 가 누락되면 (graceful degrade)") {
            then("dedup 없이 reserve 가 실행되고 missingId 메트릭이 노출되어야 한다") {
                val missingIdPayload = """{"orderId":3,"userId":"user1","totalAmount":10000,"status":"COMPLETED","items":[{"productId":100,"quantity":2,"unitPrice":5000}],"eventTime":"2026-04-07T10:00:00"}"""
                val record = ConsumerRecord("order.order.completed", 0, 0, "3", missingIdPayload)

                every { reserveStockUseCase.execute(any()) } returns ReserveStockUseCase.Result(1L, 100L, 8, 2)

                consumer.onOrderCompleted(record)

                verify(exactly = 1) { reserveStockUseCase.execute(match { it.orderId == 3L && it.productId == 100L }) }
                verify(exactly = 1) { idempotentMetrics.missingId("inventory-service") }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
            }
        }
    }

    given("fulfillment.order.shipped 이벤트 수신 시 (helper 이관)") {
        val payload = """{"eventId":"$shippedEventId","orderId":10,"eventTime":"2026-04-07T11:00:00"}"""

        `when`("새로운 eventId이면 (helper PROCESSED)") {
            then("재고 확정이 실행되고 helper.process 가 한 번 호출되어야 한다") {
                val record = ConsumerRecord("fulfillment.order.shipped", 0, 0, "10", payload)

                stubProcessExecutes(shippedEventId)
                every { confirmStockByOrderUseCase.execute(any()) } returns listOf(
                    ConfirmStockByOrderUseCase.Result(productId = 100L, availableQty = 45, reservedQty = 5)
                )

                consumer.onFulfillmentShipped(record)

                verify(exactly = 1) { confirmStockByOrderUseCase.execute(match { it.orderId == 10L }) }
                verify(exactly = 1) {
                    idempotentEventHandler.process(eq(shippedEventId), eq("inventory-service"), any())
                }
            }
        }

        `when`("이미 처리된 eventId이면 (helper SKIPPED)") {
            then("재고 확정이 실행되지 않아야 한다") {
                val record = ConsumerRecord("fulfillment.order.shipped", 0, 0, "10", payload)

                stubProcessSkips(shippedEventId)

                consumer.onFulfillmentShipped(record)

                verify(exactly = 0) { confirmStockByOrderUseCase.execute(any()) }
            }
        }

        `when`("eventId 가 누락되면 (graceful degrade)") {
            then("dedup 없이 비즈니스 로직이 실행되고 missingId 메트릭이 노출되어야 한다") {
                val missingIdPayload = """{"orderId":10,"eventTime":"2026-04-07T11:00:00"}"""
                val record = ConsumerRecord("fulfillment.order.shipped", 0, 0, "10", missingIdPayload)

                every { confirmStockByOrderUseCase.execute(any()) } returns emptyList()

                consumer.onFulfillmentShipped(record)

                verify(exactly = 1) { confirmStockByOrderUseCase.execute(match { it.orderId == 10L }) }
                verify(exactly = 1) { idempotentMetrics.missingId("inventory-service") }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
            }
        }
    }

    given("fulfillment.order.cancelled 이벤트 수신 시 (helper 이관)") {
        val payload = """{"eventId":"$cancelEventId","orderId":20,"eventTime":"2026-04-07T12:00:00"}"""

        `when`("새로운 eventId이면 (helper PROCESSED)") {
            then("재고 해제가 실행되고 helper.process 가 한 번 호출되어야 한다") {
                val record = ConsumerRecord("fulfillment.order.cancelled", 0, 0, "20", payload)

                stubProcessExecutes(cancelEventId)
                every { releaseStockByOrderUseCase.execute(any()) } returns listOf(
                    ReleaseStockByOrderUseCase.Result(productId = 100L, availableQty = 50, reservedQty = 0)
                )

                consumer.onFulfillmentCancelled(record)

                verify(exactly = 1) { releaseStockByOrderUseCase.execute(match { it.orderId == 20L }) }
                verify(exactly = 1) {
                    idempotentEventHandler.process(eq(cancelEventId), eq("inventory-service"), any())
                }
            }
        }

        `when`("이미 처리된 eventId이면 (helper SKIPPED)") {
            then("재고 해제가 실행되지 않아야 한다") {
                val record = ConsumerRecord("fulfillment.order.cancelled", 0, 0, "20", payload)

                stubProcessSkips(cancelEventId)

                consumer.onFulfillmentCancelled(record)

                verify(exactly = 0) { releaseStockByOrderUseCase.execute(any()) }
            }
        }
    }

    // ADR-0032 Part 2 / PR-3 — order.order.cancelled 보상 흐름 검증 (PR-8 helper 이관)
    given("order.order.cancelled 이벤트 수신 시 (helper 이관)") {
        val paymentFailedPayload = """{"eventId":"$orderCancelled1","orderId":30,"userId":"user1","reason":"PAYMENT_FAILED","cancelledAt":"2026-05-01T10:00:00","eventTime":"2026-05-01T10:00:00"}"""
        val legacyPayload = """{"eventId":"$orderCancelled2","orderId":31,"userId":"user1","eventTime":"2026-05-01T10:00:00"}"""

        `when`("결제 실패 (PAYMENT_FAILED) 로 새 이벤트가 도착하면 (helper PROCESSED)") {
            then("releaseStockByOrderUseCase 가 호출되고 helper.process 가 한 번 호출되어야 한다") {
                val record = ConsumerRecord("order.order.cancelled", 0, 0, "30", paymentFailedPayload)

                stubProcessExecutes(orderCancelled1)
                every { releaseStockByOrderUseCase.execute(any()) } returns listOf(
                    ReleaseStockByOrderUseCase.Result(productId = 200L, availableQty = 10, reservedQty = 0)
                )

                consumer.onOrderCancelled(record)

                verify(exactly = 1) { releaseStockByOrderUseCase.execute(match { it.orderId == 30L }) }
                verify(exactly = 1) {
                    idempotentEventHandler.process(eq(orderCancelled1), eq("inventory-service"), any())
                }
            }
        }

        `when`("같은 eventId 가 두 번 도착하면 (helper SKIPPED)") {
            then("releaseStockByOrderUseCase 는 호출되지 않아야 한다") {
                val record = ConsumerRecord("order.order.cancelled", 0, 0, "30", paymentFailedPayload)

                stubProcessSkips(orderCancelled1)

                consumer.onOrderCancelled(record)

                verify(exactly = 0) { releaseStockByOrderUseCase.execute(any()) }
            }
        }

        `when`("reason 필드가 없는 (legacy) payload 가 도착하면 (forward-compat, helper PROCESSED)") {
            then("기본값 UNKNOWN 으로 release 가 정상 실행되어야 한다") {
                val record = ConsumerRecord("order.order.cancelled", 0, 0, "31", legacyPayload)

                stubProcessExecutes(orderCancelled2)
                every { releaseStockByOrderUseCase.execute(any()) } returns listOf(
                    ReleaseStockByOrderUseCase.Result(productId = 201L, availableQty = 5, reservedQty = 0)
                )

                consumer.onOrderCancelled(record)

                verify(exactly = 1) { releaseStockByOrderUseCase.execute(match { it.orderId == 31L }) }
            }
        }

        `when`("active reservation 이 없으면 (fulfillment.cancelled 가 먼저 처리된 경우)") {
            then("release 는 빈 list 를 반환하지만 helper.process 는 정상 호출되어야 한다 (자연 멱등)") {
                val racePayload = """{"eventId":"$orderCancelled3","orderId":32,"userId":"user1","reason":"PAYMENT_FAILED","eventTime":"2026-05-01T10:00:00"}"""
                val record = ConsumerRecord("order.order.cancelled", 0, 0, "32", racePayload)

                stubProcessExecutes(orderCancelled3)
                every { releaseStockByOrderUseCase.execute(any()) } returns emptyList()

                consumer.onOrderCancelled(record)

                verify(exactly = 1) { releaseStockByOrderUseCase.execute(match { it.orderId == 32L }) }
                verify(exactly = 1) {
                    idempotentEventHandler.process(eq(orderCancelled3), eq("inventory-service"), any())
                }
            }
        }

        `when`("eventId 가 누락되면 (graceful degrade)") {
            then("dedup 없이 release 가 실행되고 missingId 메트릭이 노출되어야 한다") {
                val missingIdPayload = """{"orderId":33,"userId":"user1","reason":"PAYMENT_FAILED","eventTime":"2026-05-01T10:00:00"}"""
                val record = ConsumerRecord("order.order.cancelled", 0, 0, "33", missingIdPayload)

                every { releaseStockByOrderUseCase.execute(any()) } returns emptyList()

                consumer.onOrderCancelled(record)

                verify(exactly = 1) { releaseStockByOrderUseCase.execute(match { it.orderId == 33L }) }
                verify(exactly = 1) { idempotentMetrics.missingId("inventory-service") }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
            }
        }
    }
})
