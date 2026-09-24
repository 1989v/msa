package com.kgd.settlement.infrastructure.config

import com.kgd.common.exception.BusinessException
import com.kgd.common.ops.DltKafka
import com.kgd.common.messaging.outbox.OutboxKafka
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
import org.springframework.kafka.core.ProducerFactory
import org.springframework.kafka.listener.ContainerProperties
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.util.backoff.FixedBackOff

/**
 * 원장·정산 컨슈머 배선. 빈 이름은 전부 `settlement` 접두(commerce 폴드에서 다른 도메인과 충돌 방지).
 *
 * settlement 는 발행하는 토픽이 없어 아웃박스가 없다 — DLT 발행용 String 프로듀서만 따로 둔다
 * (받은 값이 이미 JSON 문자열이라 JSON 직렬화기로 보내면 한 번 더 인용된다).
 */
@Configuration
class SettlementKafkaConfig {

    @Bean
    fun settlementConsumerFactory(
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
    fun settlementDltProducerFactory(
        @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
    ): ProducerFactory<String, String> = OutboxKafka.producerFactory(bootstrapServers)

    @Bean
    fun settlementDltKafkaTemplate(
        @Qualifier("settlementDltProducerFactory") producerFactory: ProducerFactory<String, String>,
    ): KafkaTemplate<String, String> = KafkaTemplate(producerFactory)

    @Bean
    fun settlementKafkaListenerContainerFactory(
        @Qualifier("settlementConsumerFactory") consumerFactory: ConsumerFactory<String, String>,
        @Qualifier("settlementDltKafkaTemplate") kafkaTemplate: KafkaTemplate<String, String>,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        ConcurrentKafkaListenerContainerFactory<String, String>().apply {
            setConsumerFactory(consumerFactory)
            containerProperties.ackMode = ContainerProperties.AckMode.RECORD
            // 추적 — 레코드의 traceparent 로 span 을 이어 리스너 로그(MDC)에 같은 traceId 가 찍힌다
            containerProperties.isObservationEnabled = true
            setCommonErrorHandler(
                DefaultErrorHandler(DltKafka.deadLetterRecoverer(kafkaTemplate), FixedBackOff(1000L, 3L)).apply {
                    // 검산 불일치·계약 위반은 다시 받아도 같다 — 바로 DLT (원장에 틀린 거래를 넣지 않는다)
                    addNotRetryableExceptions(BusinessException::class.java, IllegalArgumentException::class.java)
                },
            )
        }

    companion object {
        const val CONSUMER_GROUP = "settlement-ledger"
    }
}
