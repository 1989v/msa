package com.kgd.search.infrastructure.config

import com.kgd.common.exception.BusinessException
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.springframework.kafka.config.AbstractKafkaListenerContainerFactory
import org.springframework.kafka.listener.DefaultErrorHandler

/**
 * ADR-0015 §2: BusinessException / IllegalArgumentException 은 재시도 무의미 → 즉시 종료.
 *
 * 검증 전략: `DefaultErrorHandler.removeClassification(cls)` 의 반환값으로 등록 여부를 판정.
 *   - addNotRetryableExceptions 로 등록된 예외 → false (이전 분류값 = not retryable)
 *   - 등록되지 않은 예외 → null
 */
class KafkaConsumerConfigTest : BehaviorSpec({

    fun extractErrorHandler(): DefaultErrorHandler {
        val config = KafkaConsumerConfig().apply {
            KafkaConsumerConfig::class.java.getDeclaredField("bootstrapServers").also {
                it.isAccessible = true
                it.set(this, "localhost:9092")
            }
            KafkaConsumerConfig::class.java.getDeclaredField("groupId").also {
                it.isAccessible = true
                it.set(this, "search-indexer-test")
            }
        }
        val factory = config.productEventListenerContainerFactory()
        val field = AbstractKafkaListenerContainerFactory::class.java
            .getDeclaredField("commonErrorHandler")
            .apply { isAccessible = true }
        return field.get(factory) as DefaultErrorHandler
    }

    given("productEventListenerContainerFactory 의 commonErrorHandler") {
        `when`("ErrorHandler 타입") {
            then("DefaultErrorHandler 여야 한다") {
                extractErrorHandler().shouldBeInstanceOf<DefaultErrorHandler>()
            }
        }

        `when`("BusinessException 의 classification") {
            then("not-retryable 로 등록되어 retry 없이 종료") {
                val result: Boolean? = extractErrorHandler()
                    .removeClassification(BusinessException::class.java)
                result.shouldNotBeNull()
                result shouldBe false
            }
        }

        `when`("IllegalArgumentException 의 classification") {
            then("not-retryable 로 등록되어 retry 없이 종료") {
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
