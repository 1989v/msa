package com.kgd.analytics.infrastructure.config

import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory

/**
 * Spring Boot 4.0 의 KafkaAutoConfiguration 이 본 모듈의 classpath/설정 조합에서
 * KafkaTemplate 을 자동 등록하지 않아 (`AnalyticsStreamTopology` 가 요구) 명시적
 * String/String ProducerFactory + Template 을 등록한다.
 *
 * **`@ConditionalOnMissingBean` 을 쓰지 않는다.** 이벤트 수집(ADR-0095)이 붙으면서
 * `KafkaTemplate<String, AnalyticsEvent>` 가 하나 더 생겼는데, 그 조건은 제네릭을 보지 않아
 * 둘 중 뒤에 오는 쪽을 통째로 지운다. 주입은 제네릭으로 갈린다.
 */
@Configuration
class KafkaProducerConfig(
    @Value("\${spring.kafka.bootstrap-servers}") private val bootstrapServers: String
) {

    @Bean
    fun analyticsProducerFactory(): ProducerFactory<String, String> {
        val props = mapOf<String, Any>(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
            ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
        )
        return DefaultKafkaProducerFactory(props)
    }

    @Bean
    fun kafkaTemplate(producerFactory: ProducerFactory<String, String>): KafkaTemplate<String, String> =
        KafkaTemplate(producerFactory)
}
