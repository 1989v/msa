package com.kgd.product.infrastructure.messaging

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.product.application.product.usecase.SyncProductStockUseCase
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
 * ADR-0029 PR-7 — InventoryStockSyncConsumer 가 common [IdempotentEventHandler] 호출로 멱등 처리를
 * 위임하는지, eventId 누락 시 graceful degrade 가 동작하는지 검증한다.
 */
class InventoryStockSyncConsumerTest : BehaviorSpec({

    val syncProductStockUseCase = mockk<SyncProductStockUseCase>(relaxed = true)
    val idempotentEventHandler = mockk<IdempotentEventHandler>(relaxed = true)
    val idempotentMetrics = mockk<IdempotentMetrics>(relaxed = true)
    val objectMapper = ObjectMapper()
    val consumer = InventoryStockSyncConsumer(
        syncProductStockUseCase = syncProductStockUseCase,
        objectMapper = objectMapper,
        idempotentEventHandler = idempotentEventHandler,
        idempotentMetrics = idempotentMetrics,
    )

    beforeEach {
        clearMocks(syncProductStockUseCase, idempotentEventHandler, idempotentMetrics)
    }

    given("onInventoryStockChanged — 정상 eventId") {
        `when`("UUID 형식 eventId + availableQty 가 페이로드에 있을 때") {
            then("idempotentEventHandler.process 가 (eventId, product-stock-sync, block) 으로 호출되고 block 안에서 syncProductStockUseCase 실행") {
                val eventId = UUID.randomUUID()
                val productId = 100L
                val availableQty = 42
                val payload = """{"eventId":"$eventId","productId":$productId,"availableQty":$availableQty}"""
                val record = ConsumerRecord("inventory.stock.received", 0, 0L, "k", payload)

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

                consumer.onInventoryStockChanged(record)

                capturedEventId.captured shouldBe eventId
                capturedGroup.captured shouldBe "product-stock-sync"

                val cmdSlot = slot<SyncProductStockUseCase.Command>()
                verify(exactly = 1) { syncProductStockUseCase.execute(capture(cmdSlot)) }
                cmdSlot.captured.productId shouldBe productId
                cmdSlot.captured.availableQty shouldBe availableQty
                verify(exactly = 0) { idempotentMetrics.missingId(any()) }
            }
        }

        `when`("이미 처리된 eventId (SKIPPED)") {
            then("idempotentEventHandler.process 가 block 을 실행하지 않으면 syncProductStockUseCase 도 호출 안 됨") {
                val eventId = UUID.randomUUID()
                val payload = """{"eventId":"$eventId","productId":1,"availableQty":10}"""
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0L, "k", payload)

                every {
                    idempotentEventHandler.process(any(), any(), any())
                } returns IdempotentEventHandler.Outcome.SKIPPED

                consumer.onInventoryStockChanged(record)

                verify(exactly = 1) { idempotentEventHandler.process(eventId, "product-stock-sync", any()) }
                verify(exactly = 0) { syncProductStockUseCase.execute(any()) }
                verify(exactly = 0) { idempotentMetrics.missingId(any()) }
            }
        }
    }

    given("onInventoryStockChanged — eventId 누락/형식 오류 (graceful degrade)") {
        `when`("eventId 필드가 없을 때") {
            then("missingId 메트릭 증가 + syncProductStockUseCase 직접 실행 + helper 미호출") {
                val productId = 7L
                val availableQty = 99
                val payload = """{"productId":$productId,"availableQty":$availableQty}"""
                val record = ConsumerRecord("inventory.stock.released", 0, 0L, "k", payload)

                consumer.onInventoryStockChanged(record)

                verify(exactly = 1) { idempotentMetrics.missingId("product-stock-sync") }
                val cmdSlot = slot<SyncProductStockUseCase.Command>()
                verify(exactly = 1) { syncProductStockUseCase.execute(capture(cmdSlot)) }
                cmdSlot.captured.productId shouldBe productId
                cmdSlot.captured.availableQty shouldBe availableQty
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
            }
        }

        `when`("eventId 가 UUID 형식이 아닐 때") {
            then("missingId 메트릭 증가 + syncProductStockUseCase 직접 실행 + helper 미호출") {
                val productId = 8L
                val availableQty = 13
                val payload = """{"eventId":"not-a-uuid","productId":$productId,"availableQty":$availableQty}"""
                val record = ConsumerRecord("inventory.stock.received", 0, 0L, "k", payload)

                consumer.onInventoryStockChanged(record)

                verify(exactly = 1) { idempotentMetrics.missingId("product-stock-sync") }
                verify(exactly = 1) { syncProductStockUseCase.execute(any()) }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
            }
        }
    }

    given("onInventoryStockChanged — availableQty 누락") {
        `when`("availableQty 필드가 페이로드에 없을 때") {
            then("syncProductStockUseCase 미호출 + helper 미호출 (early return)") {
                val eventId = UUID.randomUUID()
                val payload = """{"eventId":"$eventId","productId":5}"""
                val record = ConsumerRecord("inventory.stock.reserved", 0, 0L, "k", payload)

                consumer.onInventoryStockChanged(record)

                verify(exactly = 0) { syncProductStockUseCase.execute(any()) }
                verify(exactly = 0) { idempotentEventHandler.process(any(), any(), any()) }
                verify(exactly = 0) { idempotentMetrics.missingId(any()) }
            }
        }
    }
})
