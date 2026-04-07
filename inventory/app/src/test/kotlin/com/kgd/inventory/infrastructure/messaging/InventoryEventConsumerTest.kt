package com.kgd.inventory.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.kgd.inventory.application.inventory.usecase.ConfirmStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockByOrderUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.infrastructure.persistence.idempotency.ProcessedEventJpaEntity
import com.kgd.inventory.infrastructure.persistence.idempotency.ProcessedEventJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.apache.kafka.clients.consumer.ConsumerRecord

class InventoryEventConsumerTest : BehaviorSpec({
    val reserveStockUseCase = mockk<ReserveStockUseCase>()
    val confirmStockByOrderUseCase = mockk<ConfirmStockByOrderUseCase>()
    val releaseStockByOrderUseCase = mockk<ReleaseStockByOrderUseCase>()
    val objectMapper = ObjectMapper().apply { registerModule(JavaTimeModule()) }
    val processedEventRepository = mockk<ProcessedEventJpaRepository>()

    val consumer = InventoryEventConsumer(
        reserveStockUseCase = reserveStockUseCase,
        confirmStockByOrderUseCase = confirmStockByOrderUseCase,
        releaseStockByOrderUseCase = releaseStockByOrderUseCase,
        objectMapper = objectMapper,
        processedEventRepository = processedEventRepository,
    )

    beforeEach { clearMocks(reserveStockUseCase, confirmStockByOrderUseCase, releaseStockByOrderUseCase, processedEventRepository) }

    given("order.order.completed 이벤트 수신 시") {
        val payload = """{"eventId":"evt-001","orderId":1,"userId":"user1","totalAmount":10000,"status":"COMPLETED","items":[{"productId":100,"quantity":2,"unitPrice":5000}],"eventTime":"2026-04-07T10:00:00"}"""

        `when`("새로운 eventId이면") {
            then("재고 예약이 실행되고 멱등성 레코드가 저장되어야 한다") {
                val record = ConsumerRecord("order.order.completed", 0, 0, "1", payload)

                every { processedEventRepository.existsById("evt-001") } returns false
                every { reserveStockUseCase.execute(any()) } returns ReserveStockUseCase.Result(1L, 100L, 8, 2)
                every { processedEventRepository.save(any()) } returns ProcessedEventJpaEntity("evt-001", "order.order.completed")

                consumer.onOrderCompleted(record)

                verify(exactly = 1) { reserveStockUseCase.execute(match { it.orderId == 1L && it.productId == 100L && it.qty == 2 }) }
                verify(exactly = 1) { processedEventRepository.save(match { it.eventId == "evt-001" }) }
            }
        }

        `when`("이미 처리된 eventId이면") {
            then("재고 예약이 실행되지 않아야 한다 (멱등성)") {
                val record = ConsumerRecord("order.order.completed", 0, 0, "1", payload)

                every { processedEventRepository.existsById("evt-001") } returns true

                consumer.onOrderCompleted(record)

                verify(exactly = 0) { reserveStockUseCase.execute(any()) }
            }
        }

        `when`("items가 비어 있으면") {
            then("예약 없이 처리가 완료되어야 한다") {
                val emptyItemsPayload = """{"eventId":"evt-002","orderId":2,"userId":"user1","totalAmount":0,"status":"COMPLETED","items":[],"eventTime":"2026-04-07T10:00:00"}"""
                val record = ConsumerRecord("order.order.completed", 0, 0, "2", emptyItemsPayload)

                every { processedEventRepository.existsById("evt-002") } returns false

                consumer.onOrderCompleted(record)

                verify(exactly = 0) { reserveStockUseCase.execute(any()) }
            }
        }
    }

    given("fulfillment.order.shipped 이벤트 수신 시") {
        val payload = """{"eventId":"evt-ship-001","orderId":10,"eventTime":"2026-04-07T11:00:00"}"""

        `when`("새로운 eventId이면") {
            then("재고 확정이 실행되어야 한다") {
                val record = ConsumerRecord("fulfillment.order.shipped", 0, 0, "10", payload)

                every { processedEventRepository.existsById("evt-ship-001") } returns false
                every { confirmStockByOrderUseCase.execute(any()) } returns listOf(
                    ConfirmStockByOrderUseCase.Result(productId = 100L, availableQty = 45, reservedQty = 5)
                )
                every { processedEventRepository.save(any()) } returns ProcessedEventJpaEntity("evt-ship-001", "fulfillment.order.shipped")

                consumer.onFulfillmentShipped(record)

                verify(exactly = 1) { confirmStockByOrderUseCase.execute(match { it.orderId == 10L }) }
                verify(exactly = 1) { processedEventRepository.save(match { it.eventId == "evt-ship-001" }) }
            }
        }

        `when`("이미 처리된 eventId이면") {
            then("재고 확정이 실행되지 않아야 한다 (멱등성)") {
                val record = ConsumerRecord("fulfillment.order.shipped", 0, 0, "10", payload)

                every { processedEventRepository.existsById("evt-ship-001") } returns true

                consumer.onFulfillmentShipped(record)

                verify(exactly = 0) { confirmStockByOrderUseCase.execute(any()) }
            }
        }
    }

    given("fulfillment.order.cancelled 이벤트 수신 시") {
        val payload = """{"eventId":"evt-cancel-001","orderId":20,"eventTime":"2026-04-07T12:00:00"}"""

        `when`("새로운 eventId이면") {
            then("재고 해제가 실행되어야 한다") {
                val record = ConsumerRecord("fulfillment.order.cancelled", 0, 0, "20", payload)

                every { processedEventRepository.existsById("evt-cancel-001") } returns false
                every { releaseStockByOrderUseCase.execute(any()) } returns listOf(
                    ReleaseStockByOrderUseCase.Result(productId = 100L, availableQty = 50, reservedQty = 0)
                )
                every { processedEventRepository.save(any()) } returns ProcessedEventJpaEntity("evt-cancel-001", "fulfillment.order.cancelled")

                consumer.onFulfillmentCancelled(record)

                verify(exactly = 1) { releaseStockByOrderUseCase.execute(match { it.orderId == 20L }) }
                verify(exactly = 1) { processedEventRepository.save(match { it.eventId == "evt-cancel-001" }) }
            }
        }

        `when`("이미 처리된 eventId이면") {
            then("재고 해제가 실행되지 않아야 한다 (멱등성)") {
                val record = ConsumerRecord("fulfillment.order.cancelled", 0, 0, "20", payload)

                every { processedEventRepository.existsById("evt-cancel-001") } returns true

                consumer.onFulfillmentCancelled(record)

                verify(exactly = 0) { releaseStockByOrderUseCase.execute(any()) }
            }
        }
    }
})
