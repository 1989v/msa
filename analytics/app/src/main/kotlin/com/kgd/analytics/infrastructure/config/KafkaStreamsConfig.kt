package com.kgd.analytics.infrastructure.config

import org.apache.kafka.common.serialization.Serdes
import org.apache.kafka.streams.StreamsConfig
import org.apache.kafka.streams.errors.LogAndContinueExceptionHandler
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.kafka.annotation.EnableKafkaStreams
import org.springframework.kafka.config.KafkaStreamsConfiguration

@Configuration
@EnableKafkaStreams
class KafkaStreamsConfig(
    @Value("\${spring.kafka.bootstrap-servers}") private val bootstrapServers: String
) {
    @Bean(name = ["defaultKafkaStreamsConfig"])
    fun kStreamsConfig(): KafkaStreamsConfiguration {
        val props = mutableMapOf<String, Any>(
            StreamsConfig.APPLICATION_ID_CONFIG to "analytics-streams",
            StreamsConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG to Serdes.StringSerde::class.java.name,
            StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG to Serdes.StringSerde::class.java.name,
            StreamsConfig.DEFAULT_DESERIALIZATION_EXCEPTION_HANDLER_CLASS_CONFIG to LogAndContinueExceptionHandler::class.java.name,
            StreamsConfig.COMMIT_INTERVAL_MS_CONFIG to 1000,
            StreamsConfig.STATE_DIR_CONFIG to "/tmp/kafka-streams/analytics"
        )
        return KafkaStreamsConfiguration(props)
    }
}
