package com.kgd.recommendation.infrastructure.kafka

import com.kgd.common.analytics.AnalyticsEvent
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.support.serializer.JsonDeserializer

/**
 * `analytics.event.collected` 토픽 소비 전용 ConsumerFactory.
 *
 * analytics 서비스가 발행하는 [AnalyticsEvent] 를 JSON 으로 역직렬화.
 * Trusted package 에 `com.kgd.common.analytics` 등록 필요.
 */
@Configuration
class KafkaConsumerConfig(
    @Value("\${spring.kafka.bootstrap-servers}") private val bootstrapServers: String,
) {
    @Bean(name = ["recommendationAnalyticsEventConsumerFactory"])
    fun analyticsEventConsumerFactory(): ConsumerFactory<String, AnalyticsEvent> {
        val props = mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to "recommendation-events-consumer",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to JsonDeserializer::class.java,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "latest",  // launch 시점부터 — backfill 은 별도 seed
            JsonDeserializer.TRUSTED_PACKAGES to "com.kgd.common.analytics",
        )
        return DefaultKafkaConsumerFactory(props)
    }

    @Bean(name = ["recommendationKafkaListenerContainerFactory"])
    fun recommendationKafkaListenerContainerFactory(): ConcurrentKafkaListenerContainerFactory<String, AnalyticsEvent> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, AnalyticsEvent>()
        factory.setConsumerFactory(analyticsEventConsumerFactory())
        return factory
    }
}
