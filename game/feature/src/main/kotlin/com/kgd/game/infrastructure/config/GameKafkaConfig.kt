package com.kgd.game.infrastructure.config

import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.core.ProducerFactory
import org.springframework.kafka.support.serializer.JacksonJsonSerializer

/**
 * ADR-0059 — 호스트 앱과 빈 이름이 충돌하지 않도록 모든 빈을 `game` 프리픽스로 등록.
 * 세션/광고 이벤트는 fire-and-forget 프로듀스(수신: analytics)라 컨슈머 팩토리는 없다.
 */
@Configuration
class GameKafkaConfig {

    @Value("\${spring.kafka.bootstrap-servers}")
    private lateinit var bootstrapServers: String

    @Bean
    fun gameProducerFactory(): ProducerFactory<String, Any> {
        val props = mapOf(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
            ProducerConfig.ACKS_CONFIG to "all",
            ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
        )
        return DefaultKafkaProducerFactory(props, StringSerializer(), JacksonJsonSerializer())
    }

    @Bean
    fun gameKafkaTemplate(
        @Qualifier("gameProducerFactory") producerFactory: ProducerFactory<String, Any>,
    ): KafkaTemplate<String, Any> = KafkaTemplate(producerFactory)
}
