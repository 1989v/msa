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
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.kafka.common.serialization.Serdes
import org.apache.kafka.common.utils.Bytes
import org.apache.kafka.streams.StreamsBuilder
import org.apache.kafka.streams.kstream.Consumed
import org.apache.kafka.streams.kstream.Grouped
import org.apache.kafka.streams.kstream.KStream
import org.apache.kafka.streams.kstream.Materialized
import org.apache.kafka.streams.kstream.TimeWindows
import org.apache.kafka.streams.state.WindowStore
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
    private val kafkaTemplate: KafkaTemplate<String, String>,
    private val smoothingProperties: SmoothingProperties,
    private val gmvAggregationProperties: GmvAggregationProperties
) {
    private val log = KotlinLogging.logger {}

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
                        orders = metrics.orders,
                        gmv1h = metrics.gmv,
                        smoothing = smoothingProperties.toConfig()
                    )

                    scoreCache.cacheProductScore(score)
                    productScoreRepository.save(score)

                    val (gmv7d, gmv30d) = aggregateGmv(productId)

                    val updateEvent = ScoreUpdateEvent(
                        productId = productId,
                        popularityScore = score.popularityScore,
                        ctr = score.ctr,
                        cvr = score.cvr,
                        ctrRaw = score.ctrRaw,
                        cvrRaw = score.cvrRaw,
                        gmv7d = gmv7d,
                        gmv30d = gmv30d,
                        updatedAt = score.updatedAt.toEpochMilli()
                    )
                    kafkaTemplate.send(
                        SCORE_OUTPUT_TOPIC,
                        productId.toString(),
                        objectMapper.writeValueAsString(updateEvent)
                    )

                    log.debug {
                        "Product score computed: productId=$productId, ctr=${score.ctr} (raw=${score.ctrRaw}), " +
                            "cvr=${score.cvr} (raw=${score.cvrRaw}), gmv7d=$gmv7d, gmv30d=$gmv30d"
                    }
                } catch (e: Exception) {
                    log.error(e) { "Failed to process product metrics: key=${windowedKey.key()}" }
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

                    log.debug { "Keyword score computed: keyword=$keyword, score=${score.score}" }
                } catch (e: Exception) {
                    log.error(e) { "Failed to process keyword metrics: key=${windowedKey.key()}" }
                }
            }
    }

    /**
     * GMV 7d/30d 합 조회. 외부화된 윈도우 기간으로 ClickHouse `product_scores.gmv_1h` 합산.
     * `enabled=false` 거나 조회 실패 시 0.0 fallback (검색 측 ranking 에는 weight 0 으로 무시됨).
     */
    private fun aggregateGmv(productId: Long): Pair<Double, Double> {
        if (!gmvAggregationProperties.enabled) return 0.0 to 0.0
        return try {
            val gmv7d = productScoreRepository.findGmvSince(productId, gmvAggregationProperties.shortWindow)
            val gmv30d = productScoreRepository.findGmvSince(productId, gmvAggregationProperties.longWindow)
            gmv7d to gmv30d
        } catch (e: Exception) {
            log.warn { "GMV aggregation failed, fallback to 0: productId=$productId, ${e.message}" }
            0.0 to 0.0
        }
    }
}
