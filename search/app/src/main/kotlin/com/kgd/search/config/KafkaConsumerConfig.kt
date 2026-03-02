package com.kgd.search.infrastructure.config

import com.kgd.search.infrastructure.messaging.ProductIndexEvent
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
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
    fun productEventConsumerFactory(): ConsumerFactory<String, ProductIndexEvent> {
        val props = mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to groupId,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to JsonDeserializer::class.java,
            JsonDeserializer.TRUSTED_PACKAGES to "com.kgd.*",
            JsonDeserializer.VALUE_DEFAULT_TYPE to ProductIndexEvent::class.java.name
        )
        return DefaultKafkaConsumerFactory(props)
    }

    @Bean
    fun productEventListenerContainerFactory(
        consumerFactory: ConsumerFactory<String, ProductIndexEvent>
    ): ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent>()
        factory.setConsumerFactory(consumerFactory)

        val backOff = ExponentialBackOff(1000L, 2.0).apply {
            maxElapsedTime = 30000L
        }
        factory.setCommonErrorHandler(DefaultErrorHandler(backOff))

        return factory
    }
}
