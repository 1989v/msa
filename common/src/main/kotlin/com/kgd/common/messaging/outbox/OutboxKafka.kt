package com.kgd.common.messaging.outbox

import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.ProducerFactory

/**
 * 릴레이 전용 프로듀서. 아웃박스 payload 는 이미 JSON 문자열이라 **값도 StringSerializer** 로 보낸다.
 * JSON 직렬화기로 보내면 문자열이 한 번 더 인용되어 컨슈머가 `"{\"...\"}"` 를 받는다.
 *
 * 타임아웃은 릴레이의 배치 기한(10초)에 맞춘다 — 브로커가 죽었을 때 `send()` 가 메타데이터를 기다리며
 * 기본 60초씩 막으면 리스(30초)가 먼저 끝나 다른 릴레이가 같은 행을 다시 보낸다.
 */
object OutboxKafka {

    fun producerFactory(bootstrapServers: String): ProducerFactory<String, String> =
        DefaultKafkaProducerFactory(
            mapOf<String, Any>(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                ProducerConfig.ACKS_CONFIG to "all",
                ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG to true,
                ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION to 5,
                ProducerConfig.MAX_BLOCK_MS_CONFIG to 10_000,
                ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG to 5_000,
                ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG to 10_000,
            ),
            StringSerializer(),
            StringSerializer(),
        )
}
