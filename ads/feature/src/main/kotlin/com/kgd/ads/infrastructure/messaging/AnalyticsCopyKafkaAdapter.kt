package com.kgd.ads.infrastructure.messaging

import com.kgd.ads.application.event.port.AnalyticsCopyPort
import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.AnalyticsEventPublisher
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.DisposableBean
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.DefaultKafkaProducerFactory
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.serializer.JsonSerializer
import org.springframework.stereotype.Component

/**
 * 광고 이벤트 사본을 `analytics.event.collected` 에 보낸다 — 값 형식(JSON)·토픽·키(방문자 id)는 공통 발행기
 * [AnalyticsEventPublisher] 와 같다. 그 발행기를 쓰지 않는 것은 보내기 실패를 묶음 단위로 끊어야 해서다(아래).
 *
 * 생산자는 이 어댑터 안에만 둔다. 빈으로 내놓으면 호스트(engagement)의 다른 Kafka 템플릿과 타입으로 섞인다.
 * 브로커 메타데이터를 기다리는 시간을 [MAX_BLOCK_MS] 로 묶는다 — 기본값(60초) 그대로면 Kafka 가 죽었을 때
 * 이벤트 요청과 클릭 리다이렉트가 그만큼 멈춘다. 그 시간 안에 메타데이터를 못 받으면 보내기가 예외로 끝나고,
 * 그러면 이 묶음의 나머지는 보내지 않는다 — 건마다 다시 기다리지 않게.
 */
@Component
class AnalyticsCopyKafkaAdapter(
    @Value("\${spring.kafka.bootstrap-servers}") bootstrapServers: String,
) : AnalyticsCopyPort, DisposableBean {

    private val log = KotlinLogging.logger {}

    private val producerFactory = DefaultKafkaProducerFactory<String, AnalyticsEvent>(
        mapOf<String, Any>(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
            ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG to JsonSerializer::class.java,
            ProducerConfig.MAX_BLOCK_MS_CONFIG to MAX_BLOCK_MS,
        ),
    )
    private val template = KafkaTemplate(producerFactory)

    override fun publish(events: List<AnalyticsEvent>) {
        events.forEachIndexed { i, event ->
            val result = try {
                template.send(AnalyticsEventPublisher.TOPIC, event.visitorId, event)
            } catch (e: RuntimeException) {
                log.warn(e) { "광고 이벤트 사본 발행 실패 — 나머지 ${events.size - i - 1}건은 보내지 않는다" }
                return
            }
            result.whenComplete { _, ex -> if (ex != null) log.warn(ex) { "광고 이벤트 사본 전송 실패: eventId=${event.eventId}" } }
        }
    }

    override fun destroy() {
        producerFactory.destroy()
    }

    companion object {
        const val MAX_BLOCK_MS = 500
    }
}
