package com.kgd.search.infrastructure.config

import com.kgd.common.exception.BusinessException
import com.kgd.search.infrastructure.messaging.ProductIndexEvent
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.JsonDeserializer
import org.springframework.util.backoff.ExponentialBackOff

@Configuration
class KafkaConsumerConfig {

    @Value("\${spring.kafka.bootstrap-servers}")
    private lateinit var bootstrapServers: String

    @Value("\${kafka.consumer.group-id}")
    private lateinit var groupId: String

    @Bean
    fun productEventListenerContainerFactory(): ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent>()
        factory.setConsumerFactory(
            DefaultKafkaConsumerFactory(
                mapOf(
                    ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                    ConsumerConfig.GROUP_ID_CONFIG to groupId,
                    ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
                    ConsumerConfig.MAX_POLL_RECORDS_CONFIG to 50,
                    ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                    ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to JsonDeserializer::class.java,
                    JsonDeserializer.TRUSTED_PACKAGES to "com.kgd.*",
                    JsonDeserializer.VALUE_DEFAULT_TYPE to ProductIndexEvent::class.java.name
                )
            )
        )
        factory.setCommonErrorHandler(
            DefaultErrorHandler(
                ExponentialBackOff(1000L, 2.0).apply { maxElapsedTime = 30_000L }
            ).apply {
                // ADR-0015 §2: 비즈니스 예외와 입력 검증 예외는 재시도 무의미 → 즉시 종료.
                addNotRetryableExceptions(
                    BusinessException::class.java,
                    IllegalArgumentException::class.java,
                )
            }
        )
        return factory
    }
}
