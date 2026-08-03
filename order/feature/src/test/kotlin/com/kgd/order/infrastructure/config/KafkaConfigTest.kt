package com.kgd.order.infrastructure.config

import com.kgd.common.exception.BusinessException
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.kafka.config.AbstractKafkaListenerContainerFactory
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.JacksonJsonSerializer

/**
 * ADR-0015 §2: BusinessException / IllegalArgumentException 은 재시도 무의미 → 즉시 DLT.
 *
 * 검증 전략:
 *   `DefaultErrorHandler.removeClassification(cls)` 는 해당 예외가 not-retryable 분류에
 *   등록되어 있을 때 true 를 반환한다. `addNotRetryableExceptions` 호출 결과를 이 API 로 검증.
 *
 *   `AbstractKafkaListenerContainerFactory#commonErrorHandler` 는 private 필드라 reflection 으로 접근.
 *   Spring Kafka 가 getter 를 제공하지 않아 우회.
 */
class OrderKafkaConfigTest : BehaviorSpec({

    fun newKafkaTemplate(): KafkaTemplate<String, Any> {
        val producerFactory = DefaultKafkaProducerFactory<String, Any>(
            mapOf(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to "localhost:9092"),
            StringSerializer(),
            JacksonJsonSerializer(),
        )
        return KafkaTemplate(producerFactory)
    }

    fun extractErrorHandler(): DefaultErrorHandler {
        val config = OrderKafkaConfig().apply {
            val field = OrderKafkaConfig::class.java.getDeclaredField("bootstrapServers")
            field.isAccessible = true
            field.set(this, "localhost:9092")
        }
        val factory = config.orderKafkaListenerContainerFactory(
            consumerFactory = config.orderConsumerFactory(),
            kafkaTemplate = newKafkaTemplate(),
        )
        val field = AbstractKafkaListenerContainerFactory::class.java
            .getDeclaredField("commonErrorHandler")
            .apply { isAccessible = true }
        return field.get(factory) as DefaultErrorHandler
    }

    given("kafkaListenerContainerFactory 의 commonErrorHandler") {
        `when`("ErrorHandler 타입") {
            then("DefaultErrorHandler 여야 한다") {
                extractErrorHandler().shouldBeInstanceOf<DefaultErrorHandler>()
            }
        }

        `when`("BusinessException 의 classification") {
            then("not-retryable 로 등록되어 즉시 DLT 직행") {
                val result: Boolean? = extractErrorHandler()
                    .removeClassification(BusinessException::class.java)
                result.shouldNotBeNull()
                result shouldBe false // false = not retryable
            }
        }

        `when`("IllegalArgumentException 의 classification") {
            then("not-retryable 로 등록되어 즉시 DLT 직행") {
                val result: Boolean? = extractErrorHandler()
                    .removeClassification(IllegalArgumentException::class.java)
                result.shouldNotBeNull()
                result shouldBe false
            }
        }

        `when`("등록되지 않은 일반 예외 (ArrayStoreException)") {
            then("not-retryable 로 명시 등록되어 있지 않다") {
                val result: Boolean? = extractErrorHandler()
                    .removeClassification(ArrayStoreException::class.java)
                result shouldBe null
            }
        }
    }
})
