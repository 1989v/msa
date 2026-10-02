package com.kgd.search.infrastructure.config

import com.kgd.common.exception.BusinessException
import com.kgd.common.ops.DltKafka
import com.kgd.search.infrastructure.messaging.ProductIndexEvent
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.ByteArraySerializer
import org.apache.kafka.common.serialization.Serializer
import org.apache.kafka.common.serialization.StringDeserializer
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaOperations
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.DelegatingByTypeSerializer
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
import org.springframework.kafka.support.serializer.JacksonJsonDeserializer
import org.springframework.kafka.support.serializer.JacksonJsonSerializer
import org.springframework.util.backoff.FixedBackOff
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule

@Configuration
class KafkaConsumerConfig {

    @Value("\${spring.kafka.bootstrap-servers}")
    private lateinit var bootstrapServers: String

    @Value("\${kafka.consumer.group-id}")
    private lateinit var groupId: String

    /**
     * Spring Boot 4.x — @EnableKafka 명시 시 Boot 의 기본 kafkaListenerContainerFactory 자동구성이
     * back off 되므로, containerFactory 미지정 리스너(ProductScoreUpdateConsumer, String 페이로드)용
     * 기본 팩토리를 명시 제공한다.
     */
    @Bean
    fun kafkaListenerContainerFactory(): ConcurrentKafkaListenerContainerFactory<String, String> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, String>()
        factory.setConsumerFactory(
            DefaultKafkaConsumerFactory(
                mapOf(
                    ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                    ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "latest",
                    ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                    ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                )
            )
        )
        return factory
    }

    /**
     * 처리 실패 레코드를 `<원 토픽>.DLT` 로 보내는 템플릿. 역직렬화에 실패한 레코드는 값이 원본 바이트로,
     * 처리 중 실패한 레코드는 [ProductIndexEvent] 로 넘어오므로 값 타입별로 직렬화기를 고른다.
     */
    @Bean
    fun productDltKafkaTemplate(): KafkaTemplate<String, Any> =
        KafkaTemplate(
            DefaultKafkaProducerFactory<String, Any>(
                mapOf(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers),
                StringSerializer(),
                DelegatingByTypeSerializer(
                    mapOf<Class<*>, Serializer<*>>(
                        ByteArray::class.java to ByteArraySerializer(),
                        ProductIndexEvent::class.java to JacksonJsonSerializer<ProductIndexEvent>(eventMapper()),
                    ),
                ),
            ),
        )

    @Bean
    fun productEventListenerContainerFactory(
        productDltKafkaTemplate: KafkaOperations<String, Any>,
    ): ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, ProductIndexEvent>()
        factory.setConsumerFactory(
            DefaultKafkaConsumerFactory(
                mapOf<String, Any>(
                    ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                    ConsumerConfig.GROUP_ID_CONFIG to groupId,
                    ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
                    ConsumerConfig.MAX_POLL_RECORDS_CONFIG to 50,
                ),
                StringDeserializer(),
                productEventDeserializer(),
            )
        )
        factory.setCommonErrorHandler(
            DefaultErrorHandler(DltKafka.deadLetterRecoverer(productDltKafkaTemplate), FixedBackOff(1_000L, 3L)).apply {
                // ADR-0015 §2: 비즈니스 예외와 입력 검증 예외는 재시도 무의미 → 바로 DLT.
                addNotRetryableExceptions(
                    BusinessException::class.java,
                    IllegalArgumentException::class.java,
                )
            }
        )
        return factory
    }

    companion object {
        /**
         * 상품 이벤트 역직렬화기. 읽지 못한 레코드는 예외를 던지는 대신 오류 헤더를 달아 넘기고,
         * 오류 처리기가 그 레코드를 재시도 없이 DLT 로 보낸 뒤 다음 레코드로 간다.
         * 생산자(product)는 `__TypeId__` 헤더에 자기 패키지 클래스를 적어 보내므로 헤더는 무시한다.
         */
        fun productEventDeserializer(): ErrorHandlingDeserializer<ProductIndexEvent> =
            ErrorHandlingDeserializer(
                JacksonJsonDeserializer(ProductIndexEvent::class.java, eventMapper(), false).ignoreTypeHeaders(),
            )

        /** Kotlin 모듈은 빠진 필드에 생성자 기본값을 쓰게 한다. 생산자가 더 가진 필드(eventId 등)는 무시한다 */
        fun eventMapper(): JsonMapper =
            JsonMapper.builder()
                .addModule(KotlinModule.Builder().build())
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .build()
    }
}
