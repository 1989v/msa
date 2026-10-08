package com.kgd.analytics.infrastructure.config

import com.kgd.common.analytics.AnalyticsEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.ConsumerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
import org.springframework.kafka.support.serializer.JacksonJsonDeserializer
import org.springframework.util.backoff.FixedBackOff

@Configuration
class KafkaConsumerConfig(
    @Value("\${spring.kafka.bootstrap-servers}") private val bootstrapServers: String
) {
    /**
     * 읽지 못한 레코드(깨진 JSON·이 서비스가 아직 모르는 enum 값)는 예외 대신 오류 헤더를 달고 넘어오게
     * [ErrorHandlingDeserializer] 로 감싼다. 감싸지 않으면 poll 단계에서 같은 오프셋에 걸려 소비가 멈춘다.
     */
    @Bean
    fun consumerFactory(): ConsumerFactory<String, AnalyticsEvent> {
        val props = mapOf(
            ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ConsumerConfig.GROUP_ID_CONFIG to "analytics-event-ingestion",
            ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to ErrorHandlingDeserializer::class.java,
            ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to ErrorHandlingDeserializer::class.java,
            ErrorHandlingDeserializer.KEY_DESERIALIZER_CLASS to StringDeserializer::class.java,
            ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS to JacksonJsonDeserializer::class.java,
            ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
            JacksonJsonDeserializer.TRUSTED_PACKAGES to "com.kgd.common.analytics"
        )
        return DefaultKafkaConsumerFactory(props)
    }

    @Bean
    fun kafkaListenerContainerFactory(): ConcurrentKafkaListenerContainerFactory<String, AnalyticsEvent> {
        val factory = ConcurrentKafkaListenerContainerFactory<String, AnalyticsEvent>()
        factory.setConsumerFactory(consumerFactory())
        factory.setCommonErrorHandler(skipAndLogErrorHandler())
        return factory
    }

    companion object {
        private val log = KotlinLogging.logger {}

        private const val RETRY_INTERVAL_MS = 1_000L
        private const val MAX_RETRIES = 3L

        /**
         * 끝내 처리하지 못한 레코드는 로그만 남기고 건너뛴다. 역직렬화 실패는 기본 분류상 재시도하지 않는다.
         * analytics 는 DLT 발행기를 두지 않는다(`docs/architecture/kafka-convention.md`).
         */
        fun skipAndLogErrorHandler(): DefaultErrorHandler =
            DefaultErrorHandler(
                { record, e ->
                    log.error(e) {
                        "[events] 처리 못 한 레코드를 건너뛴다: topic=${record.topic()}, " +
                            "partition=${record.partition()}, offset=${record.offset()}"
                    }
                },
                FixedBackOff(RETRY_INTERVAL_MS, MAX_RETRIES),
            )
    }
}
