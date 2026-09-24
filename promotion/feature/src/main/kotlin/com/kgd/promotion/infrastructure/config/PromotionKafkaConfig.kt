package com.kgd.promotion.infrastructure.config

import com.kgd.common.exception.BusinessException
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.listener.ContainerProperties
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.util.backoff.FixedBackOff

/**
 * `promotion.command.*` 컨슈머 배선. 빈 이름은 전부 `promotion` 접두(commerce 폴드에서 다른 도메인과 충돌 방지).
 * DLT 발행은 아웃박스 릴레이의 String 템플릿을 같이 쓴다 — 받은 값이 이미 JSON 문자열이다.
 */
@Configuration
class PromotionKafkaConfig {

    @Bean
    fun promotionConsumerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
    ): ConsumerFactory<String, String> = DefaultKafkaConsumerFactory(
        mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to CONSUMER_GROUP,
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
            ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false,
        ),
    )

    @Bean
    fun promotionKafkaListenerContainerFactory(
        @Qualifier("promotionConsumerFactory") consumerFactory: ConsumerFactory<String, String>,
        @Qualifier("promotionOutboxKafkaTemplate") kafkaTemplate: KafkaTemplate<String, String>,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        ConcurrentKafkaListenerContainerFactory<String, String>().apply {
            setConsumerFactory(consumerFactory)
            containerProperties.ackMode = ContainerProperties.AckMode.RECORD
            setCommonErrorHandler(
                DefaultErrorHandler(DeadLetterPublishingRecoverer(kafkaTemplate), FixedBackOff(1000L, 3L)).apply {
                    // 상태 위반·입력 오류는 다시 보내도 같다 — 바로 DLT
                    addNotRetryableExceptions(BusinessException::class.java, IllegalArgumentException::class.java)
                },
            )
        }

    companion object {
        const val CONSUMER_GROUP = "promotion-service"
    }
}
