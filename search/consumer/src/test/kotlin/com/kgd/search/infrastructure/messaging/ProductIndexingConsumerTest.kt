package com.kgd.search.infrastructure.messaging

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.infrastructure.indexing.EsBulkDocumentProcessor
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import io.mockk.verify
import java.math.BigDecimal
import java.time.LocalDateTime

class ProductIndexingConsumerTest : BehaviorSpec({
    val bulkProcessor = mockk<EsBulkDocumentProcessor>(relaxed = true)
    val consumer = ProductIndexingConsumer(bulkProcessor)

    // inject @Value field via reflection
    consumer.javaClass.getDeclaredField("indexAlias").apply {
        isAccessible = true
        set(consumer, "products")
    }

    beforeEach { clearMocks(bulkProcessor) }

    val event = ProductIndexEvent(
        productId = 1L,
        name = "테스트 상품",
        price = BigDecimal("10000"),
        status = "ACTIVE",
        eventTime = LocalDateTime.of(2026, 3, 9, 12, 0, 0)
    )

    given("유효한 ProductIndexEvent 수신 시") {
        `when`("consume이 호출되면") {
            then("bulkProcessor.processDocument가 올바른 인덱스와 문서로 호출되어야 한다") {
                val docSlot = slot<ProductDocument>()
                every { bulkProcessor.processDocument(any(), capture(docSlot)) } just runs

                consumer.consume(event)

                verify(exactly = 1) { bulkProcessor.processDocument("products", any()) }
                docSlot.captured.id shouldBe "1"
                docSlot.captured.name shouldBe "테스트 상품"
                docSlot.captured.price shouldBe BigDecimal("10000")
                docSlot.captured.status shouldBe "ACTIVE"
                docSlot.captured.createdAt shouldBe event.eventTime
            }
        }
    }

    given("bulkProcessor가 예외를 던질 때") {
        `when`("consume이 호출되면") {
            then("예외가 재전파되어야 한다 (Spring Kafka 재시도를 위해)") {
                every { bulkProcessor.processDocument(any(), any()) } throws RuntimeException("ES down")
                shouldThrow<RuntimeException> { consumer.consume(event) }
            }
        }
    }
})
