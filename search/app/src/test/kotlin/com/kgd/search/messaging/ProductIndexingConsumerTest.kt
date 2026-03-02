package com.kgd.search.infrastructure.messaging

import com.kgd.search.domain.product.model.ProductDocument
import com.kgd.search.domain.product.port.ProductIndexPort
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.math.BigDecimal
import java.time.LocalDateTime

class ProductIndexingConsumerTest : BehaviorSpec({
    val productIndexPort = mockk<ProductIndexPort>(relaxed = true)
    val consumer = ProductIndexingConsumer(productIndexPort)

    beforeEach { clearMocks(productIndexPort) }

    given("Kafka 이벤트 수신 시") {
        `when`("유효한 ProductIndexEvent이 들어오면") {
            then("ProductDocument로 변환하여 인덱싱해야 한다") {
                val eventTime = LocalDateTime.of(2024, 1, 15, 10, 0, 0)
                val event = ProductIndexEvent(
                    productId = 1L,
                    name = "테스트 상품",
                    price = BigDecimal("10000"),
                    status = "ACTIVE",
                    eventTime = eventTime
                )

                val docSlot = slot<ProductDocument>()
                every { productIndexPort.indexProduct(capture(docSlot)) } returns Unit

                consumer.consume(event)

                verify(exactly = 1) { productIndexPort.indexProduct(any()) }
                docSlot.captured.id shouldBe "1"
                docSlot.captured.name shouldBe "테스트 상품"
                docSlot.captured.price shouldBe BigDecimal("10000")
                docSlot.captured.status shouldBe "ACTIVE"
                docSlot.captured.createdAt shouldBe eventTime
            }
        }

        `when`("indexProduct가 예외를 던지면") {
            then("예외가 재전파되어야 한다 (Spring Kafka가 재시도 처리)") {
                val event = ProductIndexEvent(productId = 2L, name = "상품", price = BigDecimal("1000"), status = "ACTIVE")
                every { productIndexPort.indexProduct(any()) } throws RuntimeException("ES connection failed")

                shouldThrow<RuntimeException> {
                    consumer.consume(event)
                }
            }
        }
    }
})
