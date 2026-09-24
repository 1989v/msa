package com.kgd.fulfillment.infrastructure.config

import com.kgd.common.exception.BusinessException
import com.kgd.common.ops.DltKafka
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.*
import org.springframework.kafka.listener.ContainerProperties
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.JacksonJsonSerializer
import org.springframework.util.backoff.FixedBackOff

/**
 * ADR-0058 — commerce 모듈러 모놀리스에서 inventory 의 KafkaConfig 와 빈 이름이 충돌하지 않도록
 * 모든 빈을 `fulfillment` 프리픽스로 등록한다(도메인 전용). 동작은 기존과 동일.
 * 재분리 시 그대로 fulfillment 와 함께 이동.
 */
@Configuration
class FulfillmentKafkaConfig {

    @Value("\${spring.kafka.bootstrap-servers}")
    private lateinit var bootstrapServers: String

    @Bean
    fun fulfillmentProducerFactory(): ProducerFactory<String, Any> {
        val props = mapOf(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
            ProducerConfig.ACKS_CONFIG to "all",
            ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
            ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,
            ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 120000
        )
        return DefaultKafkaProducerFactory(props, StringSerializer(), JacksonJsonSerializer())
    }

    @Bean
    fun fulfillmentKafkaTemplate(
        @org.springframework.beans.factory.annotation.Qualifier("fulfillmentProducerFactory")
        producerFactory: ProducerFactory<String, Any>,
    ): KafkaTemplate<String, Any> = KafkaTemplate(producerFactory)

    @Bean
    fun fulfillmentConsumerFactory(): ConsumerFactory<String, String> {
        val props = mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to "fulfillment-service",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
            ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false
        )
        return DefaultKafkaConsumerFactory(props)
    }

    @Bean
    fun fulfillmentKafkaListenerContainerFactory(
        @org.springframework.beans.factory.annotation.Qualifier("fulfillmentConsumerFactory")
        consumerFactory: ConsumerFactory<String, String>,
        // DLT 는 받은 원문(JSON 문자열)을 그대로 — JSON 직렬화 템플릿이면 한 번 더 인용돼 재발행한 값이 깨진다
        @org.springframework.beans.factory.annotation.Qualifier("fulfillmentOutboxKafkaTemplate")
        kafkaTemplate: KafkaTemplate<String, *>,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        ConcurrentKafkaListenerContainerFactory<String, String>().apply {
            setConsumerFactory(consumerFactory)
            containerProperties.ackMode = ContainerProperties.AckMode.RECORD
            // 추적 — 레코드의 traceparent 로 span 을 이어 리스너 로그(MDC)에 같은 traceId 가 찍힌다
            containerProperties.isObservationEnabled = true
            setCommonErrorHandler(
                DefaultErrorHandler(
                    DltKafka.deadLetterRecoverer(kafkaTemplate),
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
