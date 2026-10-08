package com.kgd.recommendation.infrastructure.kafka

import com.kgd.common.analytics.AnalyticsEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
import org.springframework.kafka.support.serializer.JacksonJsonDeserializer
import org.springframework.util.backoff.FixedBackOff

/**
 * `analytics.event.collected` 토픽 소비 전용 ConsumerFactory.
 *
 * analytics 서비스가 발행하는 [AnalyticsEvent] 를 JSON 으로 역직렬화.
 * Trusted package 에 `com.kgd.common.analytics` 등록 필요.
 *
 * 역직렬화는 Jackson 3([JacksonJsonDeserializer]) 로 한다 — 런타임에 Jackson 2 Kotlin 모듈이 없어
 * Jackson 2 역직렬화기로는 Kotlin data class 를 만들지 못한다. 읽지 못한 레코드(깨진 JSON·아직 모르는
 * enum 값)는 [ErrorHandlingDeserializer] 가 오류 헤더로 넘기고, 오류 처리기가 로그를 남기고 건너뛴다.
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
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to ErrorHandlingDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to ErrorHandlingDeserializer::class.java,
            ErrorHandlingDeserializer.KEY_DESERIALIZER_CLASS to StringDeserializer::class.java,
            ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS to JacksonJsonDeserializer::class.java,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "latest",  // launch 시점부터 — backfill 은 별도 seed
            JacksonJsonDeserializer.TRUSTED_PACKAGES to "com.kgd.common.analytics",
        )
        return DefaultKafkaConsumerFactory(props)
    }

    @Bean(name = ["recommendationKafkaListenerContainerFactory"])
    fun recommendationKafkaListenerContainerFactory(): ConcurrentKafkaListenerContainerFactory<String, AnalyticsEvent> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, AnalyticsEvent>()
        factory.setConsumerFactory(analyticsEventConsumerFactory())
        factory.setCommonErrorHandler(skipAndLogErrorHandler())
        return factory
    }

    // Phase 7 — click event 용 String consumer (간단 payload 처리)
    @Bean(name = ["recommendationStringConsumerFactory"])
    fun stringConsumerFactory(): ConsumerFactory<String, String> {
        val props = mapOf<String, Any>(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to "recommendation-click-consumer",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "latest",
        )
        return DefaultKafkaConsumerFactory(props)
    }

    @Bean(name = ["recommendationStringKafkaListenerContainerFactory"])
    fun stringKafkaListenerContainerFactory(): ConcurrentKafkaListenerContainerFactory<String, String> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, String>()
        factory.setConsumerFactory(stringConsumerFactory())
        return factory
    }

    // Phase 7 — impression event publish 용 String producer
    @Bean
    fun recommendationStringProducerFactory(): ProducerFactory<String, String> {
        val props = mapOf<String, Any>(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
            ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
            ProducerConfig.ACKS_CONFIG to "1",
            ProducerConfig.LINGER_MS_CONFIG to 20,
        )
        return DefaultKafkaProducerFactory(props)
    }

    @Bean
    fun stringKafkaTemplate(): KafkaTemplate<String, String> =
        KafkaTemplate(recommendationStringProducerFactory())

    companion object {
        private val log = KotlinLogging.logger {}

        private const val RETRY_INTERVAL_MS = 1_000L
        private const val MAX_RETRIES = 3L

        /**
         * 끝내 처리하지 못한 레코드는 로그만 남기고 건너뛴다. 역직렬화 실패는 기본 분류상 재시도하지 않는다.
         * 원장 토픽은 analytics 소유이고 그쪽도 DLT 를 두지 않아 여기서도 DLT 토픽을 만들지 않는다.
         */
        fun skipAndLogErrorHandler(): DefaultErrorHandler =
            DefaultErrorHandler(
                { record, e ->
                    log.error(e) {
                        "[recommendation] 처리 못 한 레코드를 건너뛴다: topic=${record.topic()}, " +
                            "partition=${record.partition()}, offset=${record.offset()}"
                    }
                },
                FixedBackOff(RETRY_INTERVAL_MS, MAX_RETRIES),
            )
    }
}
