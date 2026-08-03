package com.kgd.wishlist.infrastructure.config

import com.kgd.common.exception.BusinessException
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory
import org.springframework.kafka.listener.ContainerProperties
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.JacksonJsonSerializer
import org.springframework.util.backoff.FixedBackOff

/**
 * ADR-0058 round 2 — commerce 모듈러 모놀리스에서 inventory 의 KafkaConfig(default 빈 이름)와
 * 충돌하지 않도록 wishlist consumer 빈을 `wishlist` 프리픽스로 등록한다(도메인 전용).
 * wishlist 는 발행 없이 소비만 — producer/kafkaTemplate 은 DLQ recoverer 용.
 * 재분리 시 그대로 wishlist 와 함께 이동.
 */
@Configuration
class WishlistKafkaConfig {

    @Value("\${spring.kafka.bootstrap-servers}")
    private lateinit var bootstrapServers: String

    @Bean
    fun wishlistProducerFactory(): ProducerFactory<String, Any> {
        val props = mapOf(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
            ProducerConfig.ACKS_CONFIG to "all",
            ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
            ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,
            ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 120000,
        )
        return DefaultKafkaProducerFactory(props, StringSerializer(), JacksonJsonSerializer())
    }

    @Bean
    fun wishlistKafkaTemplate(
        @Qualifier("wishlistProducerFactory") producerFactory: ProducerFactory<String, Any>,
    ): KafkaTemplate<String, Any> = KafkaTemplate(producerFactory)

    @Bean
    fun wishlistConsumerFactory(): ConsumerFactory<String, String> {
        val props = mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to "wishlist-service",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
            ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false,
        )
        return DefaultKafkaConsumerFactory(props)
    }

    @Bean
    fun wishlistKafkaListenerContainerFactory(
        @Qualifier("wishlistConsumerFactory") consumerFactory: ConsumerFactory<String, String>,
        @Qualifier("wishlistKafkaTemplate") kafkaTemplate: KafkaTemplate<String, Any>,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        ConcurrentKafkaListenerContainerFactory<String, String>().apply {
            setConsumerFactory(consumerFactory)
            containerProperties.ackMode = ContainerProperties.AckMode.RECORD
            setCommonErrorHandler(
                DefaultErrorHandler(
                    DeadLetterPublishingRecoverer(kafkaTemplate),
                    FixedBackOff(1000L, 3L),
                ).apply {
                    addNotRetryableExceptions(
                        BusinessException::class.java,
                        IllegalArgumentException::class.java,
                    )
                }
            )
        }
}
