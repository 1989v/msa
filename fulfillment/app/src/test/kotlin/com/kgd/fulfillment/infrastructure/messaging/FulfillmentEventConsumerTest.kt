package com.kgd.fulfillment.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.apache.kafka.clients.consumer.ConsumerRecord
import java.util.UUID

/**
 * ADR-0029 PR-5 (Phase 3) — fulfillment 컨슈머가 common
 * [com.kgd.common.messaging.IdempotentEventHandler] 를 위임 사용하도록 전환된 후의 단위 테스트.
 *
 * `processedEventRepository` 직접 의존이 사라지고, `idempotentEventHandler.process(...)` mock 으로
 * 멱등 분기를 검증한다.
 */
class FulfillmentEventConsumerTest : BehaviorSpec({
    val createFulfillmentUseCase = mockk<CreateFulfillmentUseCase>()
    val objectMapper = ObjectMapper().apply { registerModule(JavaTimeModule()) }
    val idempotentEventHandler = mockk<IdempotentEventHandler>()
    val idempotentMetrics = mockk<IdempotentMetrics>(relaxed = true)

    val consumer = FulfillmentEventConsumer(
        createFulfillmentUseCase = createFulfillmentUseCase,
        objectMapper = objectMapper,
        idempotentEventHandler = idempotentEventHandler,
        idempotentMetrics = idempotentMetrics,
    )

    beforeEach { clearMocks(createFulfillmentUseCase, idempotentEventHandler, idempotentMetrics) }

    val stockReservedEventId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    given("inventory.stock.reserved 이벤트 수신 시") {
        val payload = """{"eventId":"$stockReservedEventId","orderId":1,"warehouseId":10,"productId":100,"qty":5,"availableQty":45}"""

        `when`("새로운 eventId이면") {
            then("idempotentEventHandler.process 가 block 을 실행하여 풀필먼트가 생성된다") {
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0, "1", payload)

                every {
                    idempotentEventHandler.process(stockReservedEventId, "fulfillment-service", any())
                } answers {
                    @Suppress("UNCHECKED_CAST")
                    (thirdArg<() -> Unit>()).invoke()
                    IdempotentEventHandler.Outcome.PROCESSED
                }
                every { createFulfillmentUseCase.execute(any()) } returns CreateFulfillmentUseCase.Result(
                    fulfillmentId = 1L,
                    orderId = 1L,
                    status = "PENDING",
                )

                consumer.onStockReserved(record)

                verify(exactly = 1) {
                    createFulfillmentUseCase.execute(match { it.orderId == 1L && it.warehouseId == 10L })
                }
                verify(exactly = 1) {
                    idempotentEventHandler.process(stockReservedEventId, "fulfillment-service", any())
                }
                verify(exactly = 0) { idempotentMetrics.missingId(any()) }
            }
        }

        `when`("이미 처리된 eventId이면") {
            then("idempotentEventHandler 가 SKIPPED 반환 시 비즈니스 로직이 실행되지 않는다") {
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0, "1", payload)

                every {
                    idempotentEventHandler.process(stockReservedEventId, "fulfillment-service", any())
                } returns IdempotentEventHandler.Outcome.SKIPPED

                consumer.onStockReserved(record)

                verify(exactly = 0) { createFulfillmentUseCase.execute(any()) }
                verify(exactly = 1) {
                    idempotentEventHandler.process(stockReservedEventId, "fulfillment-service", any())
                }
            }
        }

        `when`("eventId가 빈 문자열이면") {
            then("graceful degrade — 멱등성 검사 없이 풀필먼트가 생성되고 missingId 메트릭이 증가한다") {
                val noEventIdPayload = """{"eventId":"","orderId":2,"warehouseId":20,"productId":200,"qty":3,"availableQty":17}"""
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0, "2", noEventIdPayload)

                every { createFulfillmentUseCase.execute(any()) } returns CreateFulfillmentUseCase.Result(
                    fulfillmentId = 2L,
                    orderId = 2L,
                    status = "PENDING",
                )

                consumer.onStockReserved(record)

                verify(exactly = 1) {
                    createFulfillmentUseCase.execute(match { it.orderId == 2L && it.warehouseId == 20L })
                }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
                verify(exactly = 1) { idempotentMetrics.missingId("fulfillment-service") }
            }
        }

        `when`("eventId가 UUID 형식이 아니면") {
            then("graceful degrade — missingId 메트릭이 증가하고 비즈니스 로직 실행") {
                val invalidPayload = """{"eventId":"not-a-uuid","orderId":3,"warehouseId":30,"productId":300,"qty":1,"availableQty":99}"""
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0, "3", invalidPayload)

                every { createFulfillmentUseCase.execute(any()) } returns CreateFulfillmentUseCase.Result(
                    fulfillmentId = 3L,
                    orderId = 3L,
                    status = "PENDING",
                )

                consumer.onStockReserved(record)

                verify(exactly = 1) {
                    createFulfillmentUseCase.execute(match { it.orderId == 3L && it.warehouseId == 30L })
                }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
                verify(exactly = 1) { idempotentMetrics.missingId("fulfillment-service") }
            }
        }
    }
})
