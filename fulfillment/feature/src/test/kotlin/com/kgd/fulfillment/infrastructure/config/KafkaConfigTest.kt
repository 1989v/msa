package com.kgd.fulfillment.infrastructure.config

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
 * 검증 전략: `DefaultErrorHandler.removeClassification(cls)` 의 반환값으로 등록 여부를 판정.
 *   - addNotRetryableExceptions 로 등록된 예외 → false (이전 분류값 = not retryable)
 *   - 등록되지 않은 예외 → null
 */
class KafkaConfigTest : BehaviorSpec({

    fun newKafkaTemplate(): KafkaTemplate<String, Any> {
        val producerFactory = DefaultKafkaProducerFactory<String, Any>(
            mapOf(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to "localhost:9092"),
            StringSerializer(),
            JacksonJsonSerializer(),
        )
        return KafkaTemplate(producerFactory)
    }

    fun extractErrorHandler(): DefaultErrorHandler {
        val config = KafkaConfig().apply {
            val field = KafkaConfig::class.java.getDeclaredField("bootstrapServers")
            field.isAccessible = true
            field.set(this, "localhost:9092")
        }
        val factory = config.kafkaListenerContainerFactory(
            consumerFactory = config.consumerFactory(),
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
                result shouldBe false
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
