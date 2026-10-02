package com.kgd.search.infrastructure.config

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import org.apache.kafka.common.header.internals.RecordHeaders
import org.springframework.kafka.support.serializer.SerializationUtils
import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * 상품 생성 이벤트를 search-consumer 가 실제로 쓰는 역직렬화기로 읽는다.
 * 본문은 생산자(product)의 ProductCreatedEvent 필드 그대로다 — search 에 없는 필드(eventId·sellerId·initialStock·occurredAt)도 들어 있다.
 */
class ProductEventDeserializerTest : BehaviorSpec({

    val topic = "product.item.created"
    val producerJson = """
        {"eventId":"0b6f0a3e-7c1d-4f4e-9d8e-1f2a3b4c5d6e","productId":42,"name":"현미 누룽지","price":3900,
         "status":"ACTIVE","sellerId":7,"initialStock":10,"brand":null,"description":"설명","category":"snack",
         "energyKcal":120.5,"carbohydrateG":null,"proteinG":null,"fatG":null,"sugarG":null,"sodiumMg":null,
         "ingredients":null,"originCountry":"KR","itemReportNo":null,
         "eventTime":"2026-10-02T10:15:30","occurredAt":"2026-10-02T01:15:30Z"}
    """.trimIndent()

    given("생산자 모양의 상품 생성 이벤트") {
        `when`("search-consumer 역직렬화기로 읽으면") {
            val headers = RecordHeaders()
            val event = KafkaConsumerConfig.productEventDeserializer()
                .deserialize(topic, headers, producerJson.toByteArray())

            then("Kotlin data class 로 만들어지고 필드가 옮겨진다") {
                event.shouldNotBeNull()
                event.productId shouldBe 42L
                event.name shouldBe "현미 누룽지"
                event.price.compareTo(BigDecimal(3900)) shouldBe 0
                event.energyKcal shouldBe 120.5
                event.eventTime shouldBe LocalDateTime.of(2026, 10, 2, 10, 15, 30)
                headers.lastHeader(SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER).shouldBeNull()
            }
        }
    }

    given("JSON 이 아닌 값") {
        `when`("역직렬화기로 읽으면") {
            val headers = RecordHeaders()
            val event = KafkaConsumerConfig.productEventDeserializer()
                .deserialize(topic, headers, "not-json".toByteArray())

            then("예외를 던지지 않고 null 과 오류 헤더를 남겨 오류 처리기가 DLT 로 보내게 한다") {
                event.shouldBeNull()
                headers.lastHeader(SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER).shouldNotBeNull()
            }
        }
    }
})
