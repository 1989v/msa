package com.kgd.analytics.infrastructure.streaming

import com.kgd.analytics.application.score.port.KeywordScoreRepositoryPort
import com.kgd.analytics.domain.model.KeywordScore
import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.apache.kafka.common.serialization.StringSerializer
import org.apache.kafka.streams.StreamsBuilder
import org.apache.kafka.streams.StreamsConfig
import org.apache.kafka.streams.TopologyTestDriver
import org.springframework.kafka.support.serializer.JacksonJsonSerde
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.util.Properties

/**
 * 키워드 지표 브랜치가 무엇을 키로 묶는지 — 토폴로지를 실제로 돌려 저장되는 [KeywordScore] 로 본다.
 */
class AnalyticsStreamTopologyKeywordTest : BehaviorSpec({

    val at = Instant.parse("2026-10-08T01:00:00Z")

    fun event(
        entityType: EntityType,
        entityId: String,
        action: EventAction,
        payload: Map<String, Any> = emptyMap(),
    ) = AnalyticsEvent(
        eventId = "e-$entityId-$action",
        entityType = entityType,
        entityId = entityId,
        action = action,
        userId = null,
        visitorId = "v1",
        sessionId = "s1",
        timestamp = at,
        experimentAssignments = null,
        payload = payload,
    )

    /** 이벤트를 차례로 흘리고, 키워드 저장소에 저장된 점수를 순서대로 돌려준다. */
    fun run(vararg events: AnalyticsEvent): List<KeywordScore> {
        val saved = mutableListOf<KeywordScore>()
        val keywordRepository = mockk<KeywordScoreRepositoryPort>()
        every { keywordRepository.save(any()) } answers { saved += firstArg<KeywordScore>() }
        val topology = AnalyticsStreamTopology(
            productScoreRepository = mockk(relaxed = true),
            keywordScoreRepository = keywordRepository,
            scoreCache = mockk(relaxed = true),
            kafkaTemplate = mockk(relaxed = true),
            smoothingProperties = SmoothingProperties(),
            gmvAggregationProperties = GmvAggregationProperties(),
        )
        val builder = StreamsBuilder()
        topology.buildPipeline(builder)
        val props = Properties().apply {
            put(StreamsConfig.APPLICATION_ID_CONFIG, "keyword-topology-test")
            put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "dummy:9092")
            put(StreamsConfig.STATESTORE_CACHE_MAX_BYTES_CONFIG, 0)
        }
        TopologyTestDriver(builder.build(), props).use { driver ->
            val serde = JacksonJsonSerde(AnalyticsEvent::class.java, jacksonMapperBuilder().build())
            val input = driver.createInputTopic(AnalyticsStreamTopology.INPUT_TOPIC, StringSerializer(), serde.serializer())
            events.forEach { input.pipeInput("v1", it, at) }
        }
        return saved
    }

    Given("검색 대상(entityType=SEARCH)의 검색 이벤트") {
        When("entityId 에 검색어가 있으면") {
            val saved = run(event(EntityType.SEARCH, "서울 궁궐", EventAction.SEARCH, mapOf("term" to "서울 궁궐")))
            Then("entityId 를 키워드로 센다") {
                saved.map { it.keyword to it.searchCount } shouldBe listOf("서울 궁궐" to 1L)
            }
        }
        When("검색어가 비었거나 전체(*)면") {
            val saved = run(
                event(EntityType.SEARCH, "*", EventAction.SEARCH),
                event(EntityType.SEARCH, "", EventAction.SEARCH),
                event(EntityType.SEARCH, "  ", EventAction.SEARCH),
            )
            Then("건너뛴다 — unknown 키로 모으지 않는다") {
                saved.shouldBeEmpty()
            }
        }
    }

    Given("상품 축의 키워드 신호 (payload.keyword)") {
        When("키워드를 단 상품 검색과 상품 클릭이 오면") {
            val saved = run(
                event(EntityType.PRODUCT, "100", EventAction.SEARCH, mapOf("keyword" to "운동화")),
                event(EntityType.PRODUCT, "100", EventAction.CLICK, mapOf("keyword" to "운동화")),
            )
            Then("지금처럼 payload.keyword 하나로 묶어 검색 1·클릭 1 이다") {
                saved.last().keyword shouldBe "운동화"
                saved.last().searchCount shouldBe 1L
                saved.last().totalClicks shouldBe 1L
            }
        }
        When("키워드 없는 상품 검색이면") {
            val saved = run(event(EntityType.PRODUCT, "100", EventAction.SEARCH))
            Then("건너뛴다 — unknown 키로 모으지 않는다") {
                saved.shouldBeEmpty()
            }
        }
        When("키워드 없는 상품 클릭이면") {
            val saved = run(event(EntityType.PRODUCT, "100", EventAction.CLICK))
            Then("키워드 지표에 들어가지 않는다") {
                saved.shouldBeEmpty()
            }
        }
    }
})
