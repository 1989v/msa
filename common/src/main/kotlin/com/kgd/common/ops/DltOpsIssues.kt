package com.kgd.common.ops

import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.TopicPartition
import org.apache.kafka.common.header.internals.RecordHeader
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory
import org.springframework.kafka.core.DefaultKafkaConsumerFactory
import org.springframework.kafka.core.KafkaOperations
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.listener.ContainerProperties
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer
import org.springframework.kafka.listener.DefaultErrorHandler
import org.springframework.util.backoff.FixedBackOff
import tools.jackson.databind.ObjectMapper
import java.util.concurrent.TimeUnit

/**
 * DLT 레코드를 운영 이슈(type=DLT)로 적재한다. DLT 토픽은 도메인끼리 겹친다 — 같은 토픽을 여러 도메인이 구독하면
 * 실패한 쪽 모두가 `<topic>.DLT` 로 보낸다. 그래서 원 컨슈머 그룹 헤더로 **자기 도메인이 실패한 것만** 받는다.
 */
class DltOpsIssueRecorder(
    private val store: OpsIssueStore,
    private val consumerGroups: Set<String>,
    private val mapper: ObjectMapper = ObjectMapper(),
) {
    private val log = KotlinLogging.logger {}

    /** 적재했으면 true. 남의 그룹·DLT 헤더 없는 레코드·이미 적재한 원 레코드는 false */
    fun record(record: ConsumerRecord<String?, String?>): Boolean {
        val dlt = DltRecord.from(record) ?: return false
        if (dlt.originalGroup !in consumerGroups) return false
        if (store.exists(DLT, dlt.targetId)) return false
        store.open(DLT, dlt.targetId, dlt.summary(), dlt.toJson(mapper))
        log.warn { "DLT → 운영 이슈: ${dlt.summary()}, target=${dlt.targetId}" }
        return true
    }

    companion object {
        const val DLT = "DLT"
    }
}

/** 운영 이슈에 남긴 DLT 레코드를 원 토픽으로 다시 보낸다 — 키·값·원 헤더 그대로 */
class DltReplayer(
    private val store: OpsIssueStore,
    private val template: KafkaTemplate<String, String>,
    private val mapper: ObjectMapper = ObjectMapper(),
) {
    fun replay(issueId: Long) {
        val json = store.payload(issueId) ?: error("DLT 기록이 없는 이슈: id=$issueId")
        val dlt = DltRecord.fromJson(json, mapper)
        val record = ProducerRecord<String, String>(dlt.originalTopic, null, dlt.key, dlt.value)
        dlt.headers.forEach { (name, bytes) -> record.headers().add(RecordHeader(name, bytes)) }
        template.send(record).get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    }

    private companion object {
        const val SEND_TIMEOUT_SECONDS = 10L
    }
}

/**
 * DLT 배선. 토픽 이름은 `<원 토픽>.DLT`(docs/architecture/kafka-convention.md) — Spring Kafka 4 의 기본값은 `-dlt` 라
 * 복구기를 [deadLetterRecoverer] 로 만들어 규약 이름을 명시한다.
 * DLT 리스너에는 DLT 발행기를 붙이지 않는다(`x.DLT.DLT` 순환 방지). 적재 실패는 뒤로 미뤄 몇 번 다시 본다.
 */
object DltKafka {
    const val SUFFIX = ".DLT"

    /** 모든 DLT 토픽. 도메인 범위는 [DltOpsIssueRecorder] 가 원 컨슈머 그룹으로 가른다 */
    const val TOPIC_PATTERN = ".*\\.DLT"

    /** 처리 실패 레코드를 `<원 토픽>.DLT` 의 같은 파티션으로(없으면 프로듀서가 고른다). 원 헤더와 예외·원 위치 헤더가 붙는다 */
    fun deadLetterRecoverer(template: KafkaOperations<*, *>): DeadLetterPublishingRecoverer =
        DeadLetterPublishingRecoverer(template) { record, _ -> TopicPartition(record.topic() + SUFFIX, record.partition()) }

    fun listenerContainerFactory(
        bootstrapServers: String,
        groupId: String,
        metadataMaxAgeMs: Long,
    ): ConcurrentKafkaListenerContainerFactory<String, String> =
        ConcurrentKafkaListenerContainerFactory<String, String>().apply {
            setConsumerFactory(
                DefaultKafkaConsumerFactory<String, String>(
                    mapOf<String, Any>(
                        ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
                        ConsumerConfig.GROUP_ID_CONFIG to groupId,
                        ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                        ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                        ConsumerConfig.AUTO_OFFSET_RESET_CONFIG to "earliest",
                        ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false,
                        // 패턴 구독은 메타데이터를 새로 받을 때 새 DLT 토픽을 알아챈다 — 기본 5분이면 첫 DLT 가 그만큼 늦는다
                        ConsumerConfig.METADATA_MAX_AGE_CONFIG to metadataMaxAgeMs.toInt(),
                    ),
                ),
            )
            containerProperties.ackMode = ContainerProperties.AckMode.RECORD
            containerProperties.isObservationEnabled = true
            setCommonErrorHandler(DefaultErrorHandler(FixedBackOff(5_000L, 12L)))
        }
}
