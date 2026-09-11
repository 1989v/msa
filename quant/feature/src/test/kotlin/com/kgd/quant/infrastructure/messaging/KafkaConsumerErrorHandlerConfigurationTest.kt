package com.kgd.quant.infrastructure.messaging

import com.kgd.common.exception.BusinessException
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.listener.DefaultErrorHandler

/**
 * TG-P2-11.6 / ADR-0015 §2:
 *   BusinessException / IllegalArgumentException 은 재시도 무의미 → 즉시 DLT.
 *
 * 검증 전략: `DefaultErrorHandler.removeClassification(cls)` 의 반환값으로 등록 여부를 판정.
 *   - addNotRetryableExceptions 로 등록된 예외 → false (이전 분류값 = not retryable)
 *   - 등록되지 않은 예외 → null
 */
class KafkaConsumerErrorHandlerConfigurationTest : BehaviorSpec({

    fun newKafkaTemplate(): KafkaTemplate<String, String> {
        val producerFactory = DefaultKafkaProducerFactory<String, String>(
            mapOf(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to "localhost:9092"),
            StringSerializer(),
            StringSerializer(),
        )
        return KafkaTemplate(producerFactory)
    }

    fun buildErrorHandler(): DefaultErrorHandler =
        KafkaConsumerErrorHandlerConfiguration()
            .defaultErrorHandler(newKafkaTemplate())

    given("defaultErrorHandler bean") {
        `when`("ErrorHandler 타입") {
            then("DefaultErrorHandler 여야 한다") {
                buildErrorHandler().shouldBeInstanceOf<DefaultErrorHandler>()
            }
        }

        `when`("BusinessException 의 classification") {
            then("not-retryable 로 등록되어 즉시 DLT 직행") {
                val result: Boolean? = buildErrorHandler()
                    .removeClassification(BusinessException::class.java)
                result.shouldNotBeNull()
                result shouldBe false
            }
        }

        `when`("IllegalArgumentException 의 classification") {
            then("not-retryable 로 등록되어 즉시 DLT 직행") {
                val result: Boolean? = buildErrorHandler()
                    .removeClassification(IllegalArgumentException::class.java)
                result.shouldNotBeNull()
                result shouldBe false
            }
        }

        `when`("등록되지 않은 일반 예외 (ArrayStoreException)") {
            then("not-retryable 로 명시 등록되어 있지 않다") {
                val result: Boolean? = buildErrorHandler()
                    .removeClassification(ArrayStoreException::class.java)
                result shouldBe null
            }
        }
    }
})
