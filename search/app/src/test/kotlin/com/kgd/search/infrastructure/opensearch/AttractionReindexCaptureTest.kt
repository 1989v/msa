package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.attraction.port.CategoryLexiconPort
import com.kgd.search.application.attraction.service.SearchAttractionService
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionKey
import com.kgd.search.domain.attraction.model.BarrierFreeInfo
import com.kgd.search.domain.attraction.model.CongestionDay
import com.kgd.search.domain.attraction.model.CourseStopsParser
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.domain.query.model.QueryIntent
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.every
import io.mockk.mockk
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import tools.jackson.module.kotlin.readValue
import java.time.LocalDate

/**
 * 재색인 왕복 — search-batch 태스클릿이 만든 bulk 문서 캡처본(`AttractionApiReindexTaskletTest` 가 쓴다)을
 * 읽기 문서로 역직렬화해 `toDomain()` → 검색 결과까지 행사 유효 기간 · 코스 구성 · 항목 유효 종료일이 남는지 본다.
 *
 * 기대값은 캡처 안의 원천 값(원천 날짜 · infoRaw)을 도메인 규칙([EventSchedule] · [CourseStopsParser])에 다시 넣어
 * 계산한다 — 읽기 클래스나 매핑 한 곳에서 필드가 빠지면 값이 null 로 떨어져 여기서 갈린다.
 * 매퍼 설정은 운영 OpenSearch 클라이언트(`OpenSearchConfig`)와 같다.
 */
class AttractionReindexCaptureTest : BehaviorSpec({

    val mapper = jacksonMapperBuilder()
        .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
        .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
        .build()

    val capture: Capture = mapper.readValue(
        AttractionReindexCaptureTest::class.java.getResource("/attraction/reindex-capture.json")!!.readText(),
    )
    val documents: Map<String, AttractionDocument> = capture.documents.associate { it.id to it.toDomain() }

    /** 캡처의 원천 날짜를 행사 규칙에 다시 넣은 기대 유효 기간. 행사가 아니면 null. */
    fun expectedPeriod(id: String): EventPeriod? {
        val doc = documents.getValue(id)
        if (!EventSchedule.isEvent(doc.contentTypeId)) return null
        val source = capture.sourceDates[id] ?: return null
        return EventSchedule.effectivePeriod(source.start, source.end)
    }

    /** 캡처의 place 부가 정보를 도메인 규칙에 다시 넣은 기대 무장애. 코드도 문장도 없으면 null. */
    fun expectedBarrierFree(id: String): BarrierFreeInfo? {
        val source = capture.sourceExtras[id] ?: return null
        val raw = source.barrierFreeDetailRaw
            ?.let { runCatching { ObjectMapper().readValue(it, Map::class.java) }.getOrNull() }
            ?.entries?.associate { (k, v) -> k.toString() to v?.toString() }
            .orEmpty()
        return BarrierFreeInfo(source.barrierFreeFlags.orEmpty(), BarrierFreeInfo.detailOf(raw))
            .takeIf { it.flags.isNotEmpty() || it.detail.isNotEmpty() }
    }

    /** 캡처의 place 집중률을 날짜로 읽어 예측일 순으로 둔 기대값. 못 읽는 날은 빠지고, 남는 날이 없으면 null. */
    fun expectedCongestion(id: String): List<CongestionDay>? =
        capture.sourceExtras[id]?.congestion
            ?.mapNotNull { day -> runCatching { LocalDate.parse(day.date) }.getOrNull()?.let { CongestionDay(it, day.rate) } }
            ?.sortedBy { it.date }
            ?.takeIf { it.isNotEmpty() }

    given("태스클릿이 만든 bulk 문서를 읽기 문서로 읽으면") {
        `when`("집중률을 보면") {
            then("place 가 준 날짜·값을 예측일 순으로 읽은 값과 같다 — 없는 문서는 null 이다") {
                documents.keys.forEach { id -> (id to documents.getValue(id).congestion) shouldBe (id to expectedCongestion(id)) }
                // 대조군: 집중률이 실린 문서가 있어야 위 비교가 무언가를 잰다
                documents.values.count { it.congestion != null } shouldBe 1
            }
        }

        `when`("무장애·웰니스를 보면") {
            then("place 가 준 코드·원문을 도메인 규칙에 다시 넣은 값과 같다 — 없는 문서는 null 이다") {
                documents.keys.forEach { id ->
                    (id to documents.getValue(id).barrierFree) shouldBe (id to expectedBarrierFree(id))
                    (id to documents.getValue(id).wellness?.code) shouldBe (id to capture.sourceExtras[id]?.wellnessThemeCode)
                }
                // 대조군: 문장까지 있는 문서 · 코드만 있는 문서 · 웰니스 문서가 다 있어야 위 비교가 무언가를 잰다
                documents.values.count { it.barrierFree?.detail?.isNotEmpty() == true } shouldBe 1
                documents.values.count { it.barrierFree != null && it.barrierFree!!.detail.isEmpty() } shouldBe 1
                documents.values.count { it.wellness != null } shouldBe 1
            }
        }

        `when`("행사 유효 기간을 보면") {
            then("원천 날짜를 정규화한 값과 같다 — 진행 중·예정·종료는 기간이, S>E·날짜 없음은 null 이다") {
                documents.keys.forEach { id -> (id to documents.getValue(id).eventPeriod) shouldBe (id to expectedPeriod(id)) }
                // 대조군: 캡처에 기간 있는 행사와 날짜 없는 행사가 둘 다 있어야 위 비교가 무언가를 잰다
                documents.values.filter { it.eventPeriod != null }.size shouldBe 3
                documents.values.count { EventSchedule.isEvent(it.contentTypeId) && it.eventPeriod == null } shouldBe 2
            }
        }

        `when`("코스 구성을 보면") {
            val ids = documents.values.associate { AttractionKey(it.lang, it.contentId) to it.id.toLong() }
            val courses = documents.values.filter { it.contentTypeId == CourseStopsParser.COURSE_CONTENT_TYPE }

            then("캡처의 infoRaw 를 파서에 다시 넣은 순서·링크와 같고, 못 읽은 원문은 null 이다") {
                courses.forEach { course ->
                    val reparsed = runCatching { ObjectMapper().readValue(course.infoRaw, Any::class.java) }.getOrNull()
                        ?.let { CourseStopsParser.parse(it, course.lang, ids).stops.takeIf { stops -> stops.isNotEmpty() } }
                    (course.id to course.courseStops) shouldBe (course.id to reparsed)
                }
                courses.mapNotNull { it.courseStops }.shouldNotBeEmpty()
                courses.single { it.id == "301" }.courseStops!!.map { it.order } shouldBe listOf(0, 1, 2, 3, 3, 4, 4, 5)
            }
        }

        `when`("가까운 곳·비슷한 곳 항목을 보면") {
            then("항목마다 그 문서의 유효 종료일이 실려 있다") {
                val nearby = documents.values.flatMap { it.region?.sameCategoryNearby.orEmpty() }
                val similar = documents.values.flatMap { it.similarElsewhere.orEmpty() }
                nearby.forEach { (it.id to it.eventEndEffective) shouldBe (it.id to expectedPeriod(it.id)?.end) }
                similar.forEach { (it.id to it.eventEndEffective) shouldBe (it.id to expectedPeriod(it.id)?.end) }
                // 대조군: 종료일을 가진 항목이 둘 다에 있어야 한다
                nearby.mapNotNull { it.eventEndEffective }.shouldNotBeEmpty()
                similar.mapNotNull { it.eventEndEffective }.shouldNotBeEmpty()
            }
        }

        `when`("단건 조회 결과로 내보내면") {
            val port = mockk<AttractionSearchPort>()
            documents.forEach { (id, doc) -> every { port.findById(id) } returns doc }
            val service = SearchAttractionService(
                port, mockk<ResolveQueryVectorUseCase>(relaxed = true),
                object : CategoryLexiconPort {
                    override fun lexicon(lang: String?) = QueryIntent.Lexicon.EMPTY
                },
                AttractionHybridProperties(enabled = false),
                QueryVectorProperties(modelRef = ""),
                SimpleMeterRegistry(),
            )

            then("가까운 곳·비슷한 곳 항목의 유효 종료일이 결과까지 남는다") {
                var checked = 0
                documents.keys.forEach { id ->
                    val result = service.findById(id)!!
                    result.region?.sameCategoryNearby.orEmpty().forEach {
                        (it.id to it.eventEndEffective) shouldBe (it.id to expectedPeriod(it.id)?.end)
                        if (it.eventEndEffective != null) checked++
                    }
                    result.similarElsewhere.orEmpty().forEach {
                        (it.id to it.eventEndEffective) shouldBe (it.id to expectedPeriod(it.id)?.end)
                        if (it.eventEndEffective != null) checked++
                    }
                }
                checked shouldNotBe 0
            }

            then("무장애 코드·문장과 웰니스 코드·이름이 상세 결과까지 남는다") {
                documents.keys.forEach { id ->
                    val result = service.findById(id)!!
                    val expected = expectedBarrierFree(id)
                    (id to result.barrierFree) shouldBe (id to expected?.flags?.takeIf { it.isNotEmpty() })
                    (id to result.barrierFreeDetail) shouldBe (id to expected?.detail?.takeIf { it.isNotEmpty() })
                    (id to result.wellnessTheme) shouldBe (id to capture.sourceExtras[id]?.wellnessThemeCode)
                }
                service.findById("202")!!.wellnessThemeName shouldBe "온천 / 사우나 / 스파"
            }

            then("집중률 날짜·값이 상세 결과까지 남는다") {
                documents.keys.forEach { id ->
                    (id to service.findById(id)!!.congestion?.map { it.date to it.rate }) shouldBe
                        (id to expectedCongestion(id)?.map { it.date to it.rate })
                }
                service.findById("402")!!.congestion!!.first().date shouldBe LocalDate.of(2026, 10, 2)
            }

            then("place 가 준 링크 원문이 상세 결과까지 값 그대로 남고, 링크 없는 문서는 null 이다") {
                val json = ObjectMapper()
                documents.keys.forEach { id ->
                    val expected = capture.sourceLinks[id]?.let { json.readTree(it) }
                    (id to service.findById(id)!!.links?.let { json.readTree(it) }) shouldBe (id to expected)
                }
                // 대조군: 링크가 실린 문서가 있어야 위 비교가 무언가를 잰다 — 수집 링크(조회수 포함)와 딥링크 둘 다
                capture.sourceLinks.keys.size shouldBe 2
                json.readTree(service.findById("201")!!.links).path("collected").path(0).path("viewCount").asLong() shouldBe 123456L
            }
        }
    }
}) {
    private data class Capture(
        val documents: List<AttractionSearchDocument>,
        val sourceDates: Map<String, SourceDates>,
        val sourceLinks: Map<String, String> = emptyMap(),
        val sourceExtras: Map<String, SourceExtras> = emptyMap(),
    )

    private data class SourceExtras(
        val barrierFreeFlags: List<String>? = null,
        val barrierFreeDetailRaw: String? = null,
        val wellnessThemeCode: String? = null,
        val congestion: List<SourceCongestionDay>? = null,
    )

    private data class SourceCongestionDay(val date: String, val rate: Double)

    private data class SourceDates(val start: LocalDate?, val end: LocalDate?)
}
