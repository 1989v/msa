package com.kgd.order.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.order.application.order.service.OrderTransactionalService
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.apache.kafka.clients.consumer.ConsumerRecord
import java.util.UUID

/**
 * ADR-0029 PR-6 — OrderEventConsumer 가 common [IdempotentEventHandler] 호출로 멱등 처리를
 * 위임하는지, eventId 누락 시 graceful degrade 가 동작하는지 검증한다.
 */
class OrderEventConsumerTest : BehaviorSpec({

    val orderTransactionalService = mockk<OrderTransactionalService>(relaxed = true)
    val idempotentEventHandler = mockk<IdempotentEventHandler>(relaxed = true)
    val idempotentMetrics = mockk<IdempotentMetrics>(relaxed = true)
    val objectMapper = ObjectMapper()
    val consumer = OrderEventConsumer(
        orderTransactionalService = orderTransactionalService,
        objectMapper = objectMapper,
        idempotentEventHandler = idempotentEventHandler,
        idempotentMetrics = idempotentMetrics,
    )

    beforeEach {
        clearMocks(orderTransactionalService, idempotentEventHandler, idempotentMetrics)
    }

    given("onReservationExpired — 정상 eventId") {
        `when`("UUID 형식 eventId 가 페이로드에 있을 때") {
            then("idempotentEventHandler.process 가 (eventId, order-service, block) 으로 호출되고 block 안에서 cancelOrder 실행") {
                val eventId = UUID.randomUUID()
                val orderId = 42L
                val payload = """{"eventId":"$eventId","orderId":$orderId}"""
                val record = ConsumerRecord("inventory.reservation.expired", 0, 0L, "k", payload)

                val capturedEventId = slot<UUID>()
                val capturedGroup = slot<String>()
                val capturedBlock = slot<() -> Unit>()
                every {
                    idempotentEventHandler.process(
                        capture(capturedEventId),
                        capture(capturedGroup),
                        capture(capturedBlock),
                    )
                } answers {
                    capturedBlock.captured.invoke()
                    IdempotentEventHandler.Outcome.PROCESSED
                }

                consumer.onReservationExpired(record)

                capturedEventId.captured shouldBe eventId
                capturedGroup.captured shouldBe "order-service"
                verify(exactly = 1) { orderTransactionalService.cancelOrder(orderId) }
                verify(exactly = 0) { idempotentMetrics.missingId(any()) }
            }
        }

        `when`("이미 처리된 eventId (SKIPPED)") {
            then("idempotentEventHandler.process 가 block 을 실행하지 않으면 cancelOrder 도 호출 안 됨") {
                val eventId = UUID.randomUUID()
                val orderId = 99L
                val payload = """{"eventId":"$eventId","orderId":$orderId}"""
                val record = ConsumerRecord("inventory.reservation.expired", 0, 0L, "k", payload)

                every {
                    idempotentEventHandler.process(any(), any(), any())
                } returns IdempotentEventHandler.Outcome.SKIPPED

                consumer.onReservationExpired(record)

                verify(exactly = 1) { idempotentEventHandler.process(eventId, "order-service", any()) }
                verify(exactly = 0) { orderTransactionalService.cancelOrder(any()) }
                verify(exactly = 0) { idempotentMetrics.missingId(any()) }
            }
        }
    }

    given("onReservationExpired — eventId 누락/형식 오류 (graceful degrade)") {
        `when`("eventId 필드가 없을 때") {
            then("missingId 메트릭 증가 + cancelOrder 직접 실행 + helper 미호출") {
                val orderId = 7L
                val payload = """{"orderId":$orderId}"""
                val record = ConsumerRecord("inventory.reservation.expired", 0, 0L, "k", payload)

                consumer.onReservationExpired(record)

                verify(exactly = 1) { idempotentMetrics.missingId("order-service") }
                verify(exactly = 1) { orderTransactionalService.cancelOrder(orderId) }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
            }
        }

        `when`("eventId 가 UUID 형식이 아닐 때") {
            then("missingId 메트릭 증가 + cancelOrder 직접 실행 + helper 미호출") {
                val orderId = 8L
                val payload = """{"eventId":"not-a-uuid","orderId":$orderId}"""
                val record = ConsumerRecord("inventory.reservation.expired", 0, 0L, "k", payload)

                consumer.onReservationExpired(record)

                verify(exactly = 1) { idempotentMetrics.missingId("order-service") }
                verify(exactly = 1) { orderTransactionalService.cancelOrder(orderId) }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
            }
        }
    }
})
