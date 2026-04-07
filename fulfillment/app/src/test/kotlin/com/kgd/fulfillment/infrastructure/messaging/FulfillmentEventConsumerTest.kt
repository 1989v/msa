package com.kgd.fulfillment.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import com.kgd.fulfillment.infrastructure.persistence.idempotency.ProcessedEventJpaEntity
import com.kgd.fulfillment.infrastructure.persistence.idempotency.ProcessedEventJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.apache.kafka.clients.consumer.ConsumerRecord

class FulfillmentEventConsumerTest : BehaviorSpec({
    val createFulfillmentUseCase = mockk<CreateFulfillmentUseCase>()
    val objectMapper = ObjectMapper().apply { registerModule(JavaTimeModule()) }
    val processedEventRepository = mockk<ProcessedEventJpaRepository>()

    val consumer = FulfillmentEventConsumer(
        createFulfillmentUseCase = createFulfillmentUseCase,
        objectMapper = objectMapper,
        processedEventRepository = processedEventRepository,
    )

    beforeEach { clearMocks(createFulfillmentUseCase, processedEventRepository) }

    given("inventory.stock.reserved 이벤트 수신 시") {
        val payload = """{"eventId":"evt-stock-001","orderId":1,"warehouseId":10,"productId":100,"qty":5,"availableQty":45}"""

        `when`("새로운 eventId이면") {
            then("풀필먼트가 생성되고 멱등성 레코드가 저장되어야 한다") {
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0, "1", payload)

                every { processedEventRepository.existsById("evt-stock-001") } returns false
                every { createFulfillmentUseCase.execute(any()) } returns CreateFulfillmentUseCase.Result(
                    fulfillmentId = 1L,
                    orderId = 1L,
                    status = "PENDING",
                )
                every { processedEventRepository.save(any()) } returns ProcessedEventJpaEntity("evt-stock-001", "inventory.stock.reserved")

                consumer.onStockReserved(record)

                verify(exactly = 1) { createFulfillmentUseCase.execute(match { it.orderId == 1L && it.warehouseId == 10L }) }
                verify(exactly = 1) { processedEventRepository.save(match { it.eventId == "evt-stock-001" }) }
            }
        }

        `when`("이미 처리된 eventId이면") {
            then("풀필먼트가 생성되지 않아야 한다 (멱등성)") {
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0, "1", payload)

                every { processedEventRepository.existsById("evt-stock-001") } returns true

                consumer.onStockReserved(record)

                verify(exactly = 0) { createFulfillmentUseCase.execute(any()) }
            }
        }

        `when`("eventId가 빈 문자열이면") {
            then("멱등성 검사 없이 풀필먼트가 생성되어야 한다") {
                val noEventIdPayload = """{"eventId":"","orderId":2,"warehouseId":20,"productId":200,"qty":3,"availableQty":17}"""
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0, "2", noEventIdPayload)

                every { createFulfillmentUseCase.execute(any()) } returns CreateFulfillmentUseCase.Result(
                    fulfillmentId = 2L,
                    orderId = 2L,
                    status = "PENDING",
                )

                consumer.onStockReserved(record)

                verify(exactly = 1) { createFulfillmentUseCase.execute(match { it.orderId == 2L && it.warehouseId == 20L }) }
                verify(exactly = 0) { processedEventRepository.existsById(any()) }
                verify(exactly = 0) { processedEventRepository.save(any()) }
            }
        }
    }
})
