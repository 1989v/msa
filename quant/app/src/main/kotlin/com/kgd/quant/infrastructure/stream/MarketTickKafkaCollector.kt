package com.kgd.quant.infrastructure.stream

import com.kgd.quant.application.market.MarketDataHub
import com.kgd.quant.application.port.marketdata.Tick
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * TG-P2-07.2 — `MarketDataHub` SharedFlow 를 별도 coroutine job 으로 collect 하여 Kafka 토픽
 * (`quant.market.tick.bithumb.v1`) 으로 fan-out 하는 옵셔널 collector.
 *
 * ## Activation
 * `quant.market.kafka-fanout.enabled=true` 일 때만 bean 생성 (Phase 2 default false).
 * 외부 분석 시스템 (analytics 등) 이 시세 스트림을 필요로 하는 시점에 활성화한다.
 *
 * ## hot path 영향 0%
 * - 별도 `CoroutineScope` (`Dispatchers.Default + SupervisorJob`) 위에서 동작.
 * - Kafka publish 실패는 `quant_market_hub_kafka_publish_failure_total` 메트릭만 증가시키고
 *   hub 의 producer / 다른 subscriber 에게 영향 0%.
 * - 토픽 partitioning key 는 symbol — 동일 거래쌍의 시세 순서 보장.
 */
@Component
@ConditionalOnProperty(
    name = ["quant.market.kafka-fanout.enabled"],
    havingValue = "true",
    matchIfMissing = false,
)
class MarketTickKafkaCollector(
    private val hub: MarketDataHub,
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val metrics: QuantMetrics,
    @Value("\${quant.market.kafka-fanout.topic:quant.market.tick.bithumb.v1}")
    private val topic: String,
) {

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var job: Job? = null

    @PostConstruct
    fun start() {
        if (job != null) return
        job = scope.launch {
            log.info { "MarketTickKafkaCollector started topic=$topic" }
            hub.asFlow().collect { tick ->
                runCatching { publish(tick) }
                    .onFailure { ex ->
                        metrics.marketHubKafkaPublishFailure()
                        // ADR-0021: 실패 사유는 warn, payload 는 로그 금지 (민감정보 방어)
                        log.warn { "kafka fan-out publish failed symbol=${tick.symbol} reason=${ex.message}" }
                    }
            }
        }
    }

    @PreDestroy
    fun stop() {
        runCatching { job?.cancel() }
        runCatching { scope.cancel() }
        job = null
        log.info { "MarketTickKafkaCollector stopped topic=$topic" }
    }

    private fun publish(tick: Tick) {
        // KafkaTemplate.send 는 ListenableFuture 반환. ack 대기는 hot path 가 아닌 collector coroutine.
        // 단순화: 동기 .get() 대신 fire-and-forget — 실패 시 SendCallback 으로 메트릭 증가.
        kafkaTemplate.send(topic, tick.symbol.value, serialize(tick))
            .whenComplete { _, ex ->
                if (ex != null) {
                    metrics.marketHubKafkaPublishFailure()
                    log.warn { "kafka fan-out async ack failed symbol=${tick.symbol} reason=${ex.message}" }
                }
            }
    }

    /**
     * Tick → JSON 직렬화 (단순 stub).
     *
     * TODO(TG-P2-12): Outbox `EventPayloadCodec` 와 동일한 Jackson registry 로 통일.
     * 본 collector 는 Phase 2 default disabled 이므로 구조화된 schema 도입은 활성 시점에 처리한다.
     */
    private fun serialize(tick: Tick): String =
        """{"symbol":"${tick.symbol.value}","price":"${tick.price.toPlainString()}",""" +
            """"volume":"${tick.volume.toPlainString()}","timestamp":"${tick.timestamp}",""" +
            """"source":"${tick.source.name}"}"""
}
