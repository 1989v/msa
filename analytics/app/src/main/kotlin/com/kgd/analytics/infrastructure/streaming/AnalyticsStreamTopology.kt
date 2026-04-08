package com.kgd.analytics.infrastructure.streaming

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.analytics.domain.model.KeywordScore
import com.kgd.analytics.domain.model.ProductScore
import com.kgd.analytics.domain.port.KeywordScoreRepositoryPort
import com.kgd.analytics.domain.port.ProductScoreRepositoryPort
import com.kgd.analytics.domain.port.ScoreCachePort
import com.kgd.analytics.infrastructure.messaging.ScoreUpdateEvent
import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EventType
import org.apache.kafka.common.serialization.Serdes
import org.apache.kafka.common.utils.Bytes
import org.apache.kafka.streams.StreamsBuilder
import org.apache.kafka.streams.kstream.Consumed
import org.apache.kafka.streams.kstream.Grouped
import org.apache.kafka.streams.kstream.KStream
import org.apache.kafka.streams.kstream.Materialized
import org.apache.kafka.streams.kstream.TimeWindows
import org.apache.kafka.streams.state.WindowStore
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.serializer.JsonSerde
import org.springframework.stereotype.Component
import java.time.Duration

@Component
class AnalyticsStreamTopology(
    private val objectMapper: ObjectMapper,
    private val productScoreRepository: ProductScoreRepositoryPort,
    private val keywordScoreRepository: KeywordScoreRepositoryPort,
    private val scoreCache: ScoreCachePort,
    private val kafkaTemplate: KafkaTemplate<String, String>
) {
    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val INPUT_TOPIC = "analytics.event.collected"
        const val SCORE_OUTPUT_TOPIC = "analytics.score.updated"
        val WINDOW_SIZE: Duration = Duration.ofHours(1)
    }

    @Autowired
    fun buildPipeline(builder: StreamsBuilder) {
        val eventSerde = JsonSerde(AnalyticsEvent::class.java, objectMapper)

        val events: KStream<String, AnalyticsEvent> = builder.stream(
            INPUT_TOPIC,
            Consumed.with(Serdes.String(), eventSerde)
        )

        // Branch 1: Product metrics (PRODUCT_VIEW, PRODUCT_CLICK, ORDER_COMPLETE)
        events
            .filter { _, event ->
                event.eventType in listOf(
                    EventType.PRODUCT_VIEW,
                    EventType.PRODUCT_CLICK,
                    EventType.ORDER_COMPLETE
                )
            }
            .selectKey { _, event -> event.payload["productId"]?.toString() ?: "unknown" }
            .groupByKey(Grouped.with(Serdes.String(), eventSerde))
            .windowedBy(TimeWindows.ofSizeWithNoGrace(WINDOW_SIZE))
            .aggregate(
                { ProductMetrics() },
                { _, event, metrics -> metrics.apply { add(event) } },
                Materialized.`as`<String, ProductMetrics, WindowStore<Bytes, ByteArray>>(
                    "product-metrics-store"
                )
                    .withKeySerde(Serdes.String())
                    .withValueSerde(JsonSerde(ProductMetrics::class.java, objectMapper))
            )
            .toStream()
            .foreach { windowedKey, metrics ->
                try {
                    val productId = windowedKey.key().toLongOrNull() ?: return@foreach
                    val score = ProductScore.compute(
                        productId = productId,
                        impressions = metrics.impressions,
                        clicks = metrics.clicks,
                        orders = metrics.orders
                    )

                    scoreCache.cacheProductScore(score)
                    productScoreRepository.save(score)

                    val updateEvent = ScoreUpdateEvent(
                        productId = productId,
                        popularityScore = score.popularityScore,
                        ctr = score.ctr,
                        cvr = score.cvr,
                        updatedAt = score.updatedAt.toEpochMilli()
                    )
                    kafkaTemplate.send(
                        SCORE_OUTPUT_TOPIC,
                        productId.toString(),
                        objectMapper.writeValueAsString(updateEvent)
                    )

                    log.debug(
                        "Product score computed: productId={}, ctr={}, cvr={}",
                        productId, score.ctr, score.cvr
                    )
                } catch (e: Exception) {
                    log.error("Failed to process product metrics: key={}", windowedKey.key(), e)
                }
            }

        // Branch 2: Keyword metrics (SEARCH_KEYWORD, PRODUCT_CLICK with keyword)
        events
            .filter { _, event ->
                event.eventType == EventType.SEARCH_KEYWORD ||
                    (event.eventType == EventType.PRODUCT_CLICK && event.payload.containsKey("keyword"))
            }
            .selectKey { _, event -> event.payload["keyword"]?.toString() ?: "unknown" }
            .groupByKey(Grouped.with(Serdes.String(), eventSerde))
            .windowedBy(TimeWindows.ofSizeWithNoGrace(WINDOW_SIZE))
            .aggregate(
                { KeywordMetrics() },
                { _, event, metrics -> metrics.apply { add(event) } },
                Materialized.`as`<String, KeywordMetrics, WindowStore<Bytes, ByteArray>>(
                    "keyword-metrics-store"
                )
                    .withKeySerde(Serdes.String())
                    .withValueSerde(JsonSerde(KeywordMetrics::class.java, objectMapper))
            )
            .toStream()
            .foreach { windowedKey, metrics ->
                try {
                    val keyword = windowedKey.key()
                    val score = KeywordScore.compute(
                        keyword = keyword,
                        searchCount = metrics.searchCount,
                        totalClicks = metrics.totalClicks,
                        totalOrders = metrics.totalOrders
                    )

                    scoreCache.cacheKeywordScore(score)
                    keywordScoreRepository.save(score)

                    log.debug("Keyword score computed: keyword={}, score={}", keyword, score.score)
                } catch (e: Exception) {
                    log.error("Failed to process keyword metrics: key={}", windowedKey.key(), e)
                }
            }
    }
}
