package com.kgd.analytics.infrastructure.config

import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventAction
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.mockk
import org.apache.kafka.clients.consumer.Consumer
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.common.header.internals.RecordHeaders
import org.apache.kafka.common.serialization.Deserializer
import org.springframework.kafka.config.AbstractKafkaListenerContainerFactory
import org.springframework.kafka.listener.CommonErrorHandler
import org.springframework.kafka.listener.MessageListenerContainer
import org.springframework.kafka.support.serializer.DeserializationException
import org.springframework.kafka.support.serializer.SerializationUtils

/**
 * 원장 토픽에 읽을 수 없는 레코드(깨진 JSON·이 서비스가 모르는 enum 값)가 와도 소비가 멈추지 않는다.
 *
 * 역직렬화기는 Kafka 클라이언트가 하는 대로 **팩토리 설정의 클래스를 만들어 그 설정으로 configure** 해서 본다.
 * 오류 처리기는 리스너 팩토리에 실제로 꽂힌 것을 꺼내 본다(getter 가 없어 reflection).
 */
class KafkaConsumerConfigTest : BehaviorSpec({

    val config = KafkaConsumerConfig("localhost:9092")
    val topic = "analytics.event.collected"

    @Suppress("UNCHECKED_CAST")
    fun deserializer(classKey: String, isKey: Boolean): Deserializer<Any?> {
        val props = config.consumerFactory().configurationProperties
        val cls = props[classKey] as Class<*>
        return (cls.getDeclaredConstructor().newInstance() as Deserializer<Any?>).apply { configure(props, isKey) }
    }

    fun typedHeaders() = RecordHeaders().apply {
        add("__TypeId__", AnalyticsEvent::class.java.name.toByteArray())
    }

    fun eventJson(action: String) = """
        {"eventId":"e1","entityType":"PRODUCT","entityId":"100","action":"$action",
         "userId":null,"visitorId":"v1","sessionId":"s1","timestamp":"2026-10-08T00:00:00Z",
         "experimentAssignments":null,"payload":{}}
    """.trimIndent().toByteArray()

    Given("값 역직렬화기") {
        val value = deserializer(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, isKey = false)

        When("정상 이벤트면") {
            Then("AnalyticsEvent 로 읽는다") {
                val event = value.deserialize(topic, typedHeaders(), eventJson("CLICK"))
                event.shouldBeInstanceOf<AnalyticsEvent>().action shouldBe EventAction.CLICK
            }
        }
        When("깨진 JSON 이면") {
            Then("예외를 던지지 않고 null + 오류 헤더로 넘긴다") {
                val headers = typedHeaders()
                value.deserialize(topic, headers, "{not json".toByteArray()) shouldBe null
                headers.lastHeader(SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER).shouldNotBeNull()
            }
        }
        When("이 서비스가 모르는 action 값이면") {
            Then("예외를 던지지 않고 null + 오류 헤더로 넘긴다") {
                val headers = typedHeaders()
                value.deserialize(topic, headers, eventJson("FILTER")) shouldBe null
                headers.lastHeader(SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER).shouldNotBeNull()
            }
        }
    }

    Given("키 역직렬화기") {
        Then("문자열 키를 그대로 읽는다") {
            deserializer(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, isKey = true)
                .deserialize(topic, RecordHeaders(), "visitor-1".toByteArray()) shouldBe "visitor-1"
        }
    }

    Given("리스너 팩토리의 오류 처리기") {
        val handler = AbstractKafkaListenerContainerFactory::class.java
            .getDeclaredField("commonErrorHandler")
            .apply { isAccessible = true }
            .get(config.kafkaListenerContainerFactory()) as CommonErrorHandler?

        When("역직렬화에 실패한 레코드가 오면") {
            Then("재시도 없이 건너뛰어 처리된 것으로 친다 — 컨테이너는 다음 레코드로 간다") {
                val record = ConsumerRecord<Any, Any>(topic, 0, 42L, "k", "raw")
                val failure = DeserializationException("bad record", "{not json".toByteArray(), false, RuntimeException())
                handler.shouldNotBeNull()
                handler.handleOne(failure, record, mockk<Consumer<*, *>>(relaxed = true), mockk<MessageListenerContainer>(relaxed = true)) shouldBe true
            }
        }
    }
})
