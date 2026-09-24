package com.kgd.common.ops

import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.support.KafkaHeaders
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import java.nio.ByteBuffer
import java.util.Base64

/**
 * DLT 로 떨어진 레코드 하나를 재발행할 수 있게 남긴 것. 헤더 값은 바이트라 Base64 로 둔다 —
 * 추적(`traceparent`) 같은 원 헤더가 그대로 돌아가야 재발행한 레코드가 원래 흐름에 이어진다.
 */
data class DltRecord(
    val originalTopic: String,
    val originalPartition: Int?,
    val originalOffset: Long?,
    val originalGroup: String?,
    val key: String?,
    val value: String?,
    /** 원 헤더(재발행 대상) — `kafka_dlt-*` 는 뺀다 */
    val headers: List<Pair<String, ByteArray>>,
    val exception: String?,
) {
    /** 같은 원 레코드가 DLT 에 두 번 와도 이슈는 한 건 — 원 토픽·파티션·오프셋이 식별자다 */
    val targetId: String get() = "$originalTopic@${originalPartition ?: "?"}:${originalOffset ?: "?"}"

    fun summary(): String = "$originalTopic key=${key ?: "-"} group=${originalGroup ?: "-"}: ${exception ?: "예외 정보 없음"}"

    fun toJson(mapper: ObjectMapper): String {
        val node = mapper.createObjectNode()
            .put("originalTopic", originalTopic)
            .put("key", key)
            .put("value", value)
            .put("originalGroup", originalGroup)
            .put("exception", exception)
        originalPartition?.let { node.put("originalPartition", it) }
        originalOffset?.let { node.put("originalOffset", it) }
        val hs = node.putArray("headers")
        headers.forEach { (name, bytes) -> hs.addObject().put("name", name).put("value", Base64.getEncoder().encodeToString(bytes)) }
        return mapper.writeValueAsString(node)
    }

    companion object {
        private const val DLT_PREFIX = "kafka_dlt-"

        /** 원 토픽 헤더가 없으면 null — DLT 발행기가 붙인 레코드가 아니다 */
        fun from(record: ConsumerRecord<String?, String?>): DltRecord? {
            val h = record.headers()
            val originalTopic = h.lastHeader(KafkaHeaders.DLT_ORIGINAL_TOPIC)?.value()?.let(::String) ?: return null
            val fqcn = h.lastHeader(KafkaHeaders.DLT_EXCEPTION_FQCN)?.value()?.let(::String)
            val message = h.lastHeader(KafkaHeaders.DLT_EXCEPTION_MESSAGE)?.value()?.let(::String)
            return DltRecord(
                originalTopic = originalTopic,
                originalPartition = h.lastHeader(KafkaHeaders.DLT_ORIGINAL_PARTITION)?.value()?.takeIf { it.size == 4 }
                    ?.let { ByteBuffer.wrap(it).int },
                originalOffset = h.lastHeader(KafkaHeaders.DLT_ORIGINAL_OFFSET)?.value()?.takeIf { it.size == 8 }
                    ?.let { ByteBuffer.wrap(it).long },
                originalGroup = h.lastHeader(KafkaHeaders.DLT_ORIGINAL_CONSUMER_GROUP)?.value()?.let(::String),
                key = record.key(),
                value = record.value(),
                headers = h.filterNot { it.key().startsWith(DLT_PREFIX) }.map { it.key() to it.value() },
                exception = listOfNotNull(fqcn, message).joinToString(": ").ifBlank { null },
            )
        }

        fun fromJson(json: String, mapper: ObjectMapper): DltRecord {
            val node = mapper.readTree(json) as ObjectNode
            fun text(name: String) = node.get(name)?.takeUnless { it.isNull }?.asString()
            return DltRecord(
                originalTopic = requireNotNull(text("originalTopic")) { "DLT 기록에 원 토픽이 없다" },
                originalPartition = node.get("originalPartition")?.takeUnless { it.isNull }?.asInt(),
                originalOffset = node.get("originalOffset")?.takeUnless { it.isNull }?.asLong(),
                originalGroup = text("originalGroup"),
                key = text("key"),
                value = text("value"),
                headers = node.get("headers")?.let { hs ->
                    (0 until hs.size()).map { i ->
                        val h = hs.get(i)
                        h.get("name").asString() to Base64.getDecoder().decode(h.get("value").asString())
                    }
                }.orEmpty(),
                exception = text("exception"),
            )
        }
    }
}
