package com.kgd.inventory.infrastructure.messaging

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.ProcessedEventRecord
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.util.UUID

/** 상품 등록의 초기 재고가 기본 창고 입고로 이어지는지 — 판정은 입고 유스케이스가 받은 명령 */
class InitialStockConsumerTest : BehaviorSpec({

    fun consumer(receive: ReceiveStockUseCase): InitialStockConsumer {
        val processed = mutableSetOf<Pair<UUID, String>>()
        val idempotent = IdempotentEventHandler(
            object : ProcessedEventRepositoryPort {
                override fun existsBy(eventId: UUID, consumerGroup: String) = (eventId to consumerGroup) in processed
                override fun mark(record: ProcessedEventRecord) {
                    processed += record.eventId to record.consumerGroup
                }
                override fun deleteOlderThan(cutoff: Instant) = 0
            },
            TransactionTemplate(mockk<PlatformTransactionManager>(relaxed = true)),
        )
        return InitialStockConsumer(receive, jacksonMapperBuilder().build(), idempotent, warehouseId = 1L)
    }

    fun created(eventId: UUID, productId: Long, initialStock: Int?) = ConsumerRecord(
        "product.item.created", 0, 0L, productId.toString(),
        """{"eventId":"$eventId","productId":$productId,"name":"두부","price":1000,"status":"ACTIVE","sellerId":1""" +
            (initialStock?.let { ""","initialStock":$it""" } ?: "") + "}",
    )

    given("재고를 입력해 등록한 상품") {
        then("기본 창고에 그 수량을 한 번 입고한다 — 같은 이벤트가 다시 와도 한 번") {
            val receive = mockk<ReceiveStockUseCase> { every { execute(any()) } returns ReceiveStockUseCase.Result(73L, 250) }
            val c = consumer(receive)
            val eventId = UUID.randomUUID()

            c.onProductCreated(created(eventId, 73L, 250))
            c.onProductCreated(created(eventId, 73L, 250))

            verify(exactly = 1) { receive.execute(ReceiveStockUseCase.Command(productId = 73L, warehouseId = 1L, qty = 250)) }
        }
    }

    given("재고 0 으로 등록했거나 초기 재고가 없는 이벤트") {
        then("입고하지 않는다") {
            val receive = mockk<ReceiveStockUseCase>()
            val c = consumer(receive)

            c.onProductCreated(created(UUID.randomUUID(), 74L, 0))
            c.onProductCreated(created(UUID.randomUUID(), 75L, null))

            verify(exactly = 0) { receive.execute(any()) }
        }
    }
})
