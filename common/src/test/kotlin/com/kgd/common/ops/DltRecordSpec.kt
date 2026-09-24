package com.kgd.common.ops

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.support.KafkaHeaders
import tools.jackson.databind.ObjectMapper
import java.nio.ByteBuffer

class DltRecordSpec : BehaviorSpec({

    fun dltRecord(group: String = "inventory-service"): ConsumerRecord<String?, String?> =
        ConsumerRecord<String?, String?>("inventory.command.reserve.DLT", 0, 3L, "880001", """{"orderId":"x"}""").apply {
            headers().add("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01".toByteArray())
            headers().add(KafkaHeaders.DLT_ORIGINAL_TOPIC, "inventory.command.reserve".toByteArray())
            headers().add(KafkaHeaders.DLT_ORIGINAL_PARTITION, ByteBuffer.allocate(4).putInt(2).array())
            headers().add(KafkaHeaders.DLT_ORIGINAL_OFFSET, ByteBuffer.allocate(8).putLong(41L).array())
            headers().add(KafkaHeaders.DLT_ORIGINAL_CONSUMER_GROUP, group.toByteArray())
            headers().add(KafkaHeaders.DLT_EXCEPTION_FQCN, "tools.jackson.core.JacksonException".toByteArray())
            headers().add(KafkaHeaders.DLT_EXCEPTION_MESSAGE, "bad orderId".toByteArray())
        }

    given("DLT 발행기가 붙인 레코드") {
        then("원 위치·그룹·예외를 읽고, 재발행할 헤더에서는 kafka_dlt-* 를 뺀다 — JSON 왕복 뒤에도 헤더 바이트가 같다") {
            val dlt = requireNotNull(DltRecord.from(dltRecord()))
            dlt.targetId shouldBe "inventory.command.reserve@2:41"
            dlt.originalGroup shouldBe "inventory-service"
            dlt.exception shouldBe "tools.jackson.core.JacksonException: bad orderId"
            dlt.headers.map { it.first } shouldBe listOf("traceparent")

            val back = DltRecord.fromJson(dlt.toJson(ObjectMapper()), ObjectMapper())
            back.originalTopic shouldBe "inventory.command.reserve"
            back.key shouldBe "880001"
            back.value shouldBe """{"orderId":"x"}"""
            String(back.headers.single().second) shouldBe "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
        }
    }

    given("원 토픽 헤더가 없는 레코드") {
        then("DLT 기록이 아니다") {
            DltRecord.from(ConsumerRecord<String?, String?>("x.DLT", 0, 0L, "k", "v")).shouldBeNull()
        }
    }
})
