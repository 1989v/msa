package com.kgd.order.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.OrderStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

/**
 * ADR-0032 PR-2 — OrderEventAdapter 가 KafkaTemplate 직접 호출이 아닌
 * common 의 OutboxPort 로 routing 되는지 검증.
 */
class OrderEventAdapterTest : BehaviorSpec({
    val outboxPort = mockk<OutboxPort>(relaxed = true)
    val objectMapper = ObjectMapper().apply { registerModule(JavaTimeModule()) }
    val adapter = OrderEventAdapter(
        outboxPort = outboxPort,
        objectMapper = objectMapper,
        completedTopic = "order.order.completed",
        cancelledTopic = "order.order.cancelled",
    )

    beforeEach { clearMocks(outboxPort) }

    given("publishOrderCompleted") {
        `when`("주문이 ID 를 가지고 있을 때") {
            then("OutboxPort.save 가 Order aggregate + completed topic 으로 호출된다") {
                val order = Order.restore(
                    42L, "user-9",
                    listOf(OrderItem.of(1L, 2, Money(5000.toBigDecimal()))),
                    OrderStatus.COMPLETED, LocalDateTime.now(),
                )
                val aggregateType = slot<String>()
                val aggregateId = slot<Long>()
                val eventType = slot<String>()
                val payload = slot<String>()
                every {
                    outboxPort.save(
                        capture(aggregateType),
                        capture(aggregateId),
                        capture(eventType),
                        capture(payload),
                    )
                } returns Unit

                adapter.publishOrderCompleted(order)

                aggregateType.captured shouldBe "Order"
                aggregateId.captured shouldBe 42L
                eventType.captured shouldBe "order.order.completed"
                // payload 가 직렬화된 JSON 인지 최소 검증 (orderId 포함)
                (payload.captured.contains("\"orderId\":42")) shouldBe true
                verify(exactly = 1) { outboxPort.save(any(), any(), any(), any()) }
            }
        }
    }

    given("publishOrderCancelled") {
        `when`("주문이 ID 를 가지고 있을 때") {
            then("OutboxPort.save 가 Order aggregate + cancelled topic 으로 호출된다") {
                val order = Order.restore(
                    7L, "user-9",
                    listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))),
                    OrderStatus.CANCELLED, LocalDateTime.now(),
                )
                val eventType = slot<String>()
                every {
                    outboxPort.save(any(), any(), capture(eventType), any())
                } returns Unit

                adapter.publishOrderCancelled(order)

                eventType.captured shouldBe "order.order.cancelled"
                verify(exactly = 1) { outboxPort.save("Order", 7L, "order.order.cancelled", any()) }
            }
        }
    }
})
