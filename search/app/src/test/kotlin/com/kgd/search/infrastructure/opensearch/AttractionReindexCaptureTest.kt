package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.attraction.usecase.CategoryLexiconUseCase
import com.kgd.search.application.attraction.service.SearchAttractionService
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.domain.attraction.model.AttractionAccess
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionFee
import com.kgd.search.domain.attraction.model.AttractionKey
import com.kgd.search.domain.attraction.model.BarrierFreeInfo
import com.kgd.search.domain.attraction.model.CongestionDay
import com.kgd.search.domain.attraction.model.CourseStopsParser
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.RelatedPlace
import com.kgd.search.domain.attraction.model.SamePlace
import com.kgd.search.domain.attraction.model.TransitKind
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
import java.time.LocalDateTime

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

    /**
     * 캡처의 place 연관 관광지(place 가 고른 순서)를 재색인 규칙에 다시 넣은 기대값 — 자기 자신·겹친 id 를 빼고, 캡처 안에 있는 같은 언어의
     * 목록에 오를 수 있는 문서(끝났거나 날짜 없는 행사는 아니다)만 그 제목으로, 앞의 [RelatedPlace.MAX] 건. 남는 것이 없으면 null.
     */
    fun expectedRelated(id: String): List<Triple<Int, String, String>>? {
        val self = documents.getValue(id)
        val today = LocalDate.of(2026, 10, 2)
        return capture.sourceExtras[id]?.relatedPlaces.orEmpty()
            .filter { it.attractionId.toString() != id }
            .distinctBy { it.attractionId }
            .mapNotNull { r ->
                documents[r.attractionId.toString()]
                    ?.takeIf { it.lang == self.lang && EventSchedule.listable(it.contentTypeId, expectedPeriod(it.id), today) }
                    ?.let { Triple(r.rank, it.id, it.title) }
            }
            .take(RelatedPlace.MAX)
            .takeIf { it.isNotEmpty() }
    }

    /** 캡처의 place 가는 법을 재색인 규칙에 다시 넣은 기대값 — 못 읽는 기준일은 비우고, 줄도 미연계 안내도 없으면 null. */
    fun expectedAccess(id: String): AttractionAccess? =
        capture.sourceExtras[id]?.access?.let { a ->
            AttractionAccess(
                a.stops.map { s ->
                    AttractionAccess.Stop(
                        TransitKind.valueOf(s.kind), s.rank, s.name, s.nameEn, s.lines, s.distanceM,
                        s.baseDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
                    )
                },
                a.busCovered,
            ).takeIf { it.hasContent }
        }

    given("태스클릿이 만든 bulk 문서를 읽기 문서로 읽으면") {
        `when`("가까운 역·정류장을 보면") {
            then("place 가 준 줄·순서·연계 판정을 재색인 규칙에 넣은 값과 같다 — 없는 문서는 null 이다") {
                documents.keys.forEach { id -> (id to documents.getValue(id).access) shouldBe (id to expectedAccess(id)) }
                // 대조군: 줄 있는 문서 · 미연계만 있는 문서 · 보일 것이 없어 빠진 문서(101)가 모두 있어야 위 비교가 무언가를 잰다
                documents.getValue("203").access!!.stops.size shouldBe 3
                documents.getValue("202").access shouldBe AttractionAccess(emptyList(), false)
                capture.sourceExtras.getValue("101").access shouldNotBe null
                documents.getValue("101").access shouldBe null
            }
        }

        `when`("연관 관광지를 보면") {
            then("place 가 준 순서·순위를 재색인 규칙에 넣은 값과 같다 — 없는 문서는 null 이다") {
                documents.keys.forEach { id ->
                    (id to documents.getValue(id).relatedPlaces?.map { Triple(it.rank, it.id, it.title) }) shouldBe (id to expectedRelated(id))
                }
                // 대조군: 목록이 실린 문서가 있고, 잘린 것(최대 6)과 빠진 것(자기 자신·끝난 행사·영문)이 있어야 위 비교가 무언가를 잰다
                documents.values.count { it.relatedPlaces != null } shouldBe 1
                capture.sourceExtras.getValue("401").relatedPlaces!!.size shouldBe 12
                documents.getValue("401").relatedPlaces!!.size shouldBe RelatedPlace.MAX
            }
        }

        `when`("같은 장소의 다른 등록을 보면") {
            then("쓰기 쪽이 실은 id·유형이 읽기 문서까지 남고, 없는 문서는 null 이다") {
                documents.getValue("501").samePlace shouldBe listOf(SamePlace("502", "38"))
                documents.getValue("502").samePlace shouldBe listOf(SamePlace("501", "12"))
                documents.values.count { it.samePlace != null } shouldBe 2
            }
        }

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

        `when`("출처·공공누리 유형·요금 텍스트를 보면") {
            // 출처 두 값은 쓰기 쪽 bulk 문서(캡처 원문)의 값과, 요금 텍스트는 캡처의 원천 두 필드를 규칙에 다시 넣은 값과 견준다
            val written = ObjectMapper().readTree(
                AttractionReindexCaptureTest::class.java.getResource("/attraction/reindex-capture.json")!!.readText(),
            ).path("documents").associate { it.path("id").asString() to it }
            fun writtenText(id: String, field: String) = written.getValue(id).path(field).takeIf { it.isString }?.asString()
            fun expectedFee(id: String) = documents.getValue(id).let { doc ->
                AttractionFee.text(doc.useFee, doc.infoRaw?.let { runCatching { ObjectMapper().readValue(it, Any::class.java) }.getOrNull() })
            }

            then("읽기 문서까지 값이 남는다 — 없는 문서는 null 이다") {
                documents.keys.forEach { id ->
                    val doc = documents.getValue(id)
                    (id to doc.source) shouldBe (id to writtenText(id, "source"))
                    (id to doc.copyrightDivCd) shouldBe (id to writtenText(id, "copyrightDivCd"))
                    (id to doc.feeText) shouldBe (id to expectedFee(id))
                }
                // 대조군: 값이 실린 문서가 있어야 위 비교가 무언가를 잰다 — use_fee 경로와 반복정보 경로 둘 다
                documents.values.count { it.source != null } shouldBe 2
                documents.getValue("201").feeText shouldBe "무료"
                documents.getValue("202").feeText shouldBe "<어린이> 무료\n어른 2,000원"
            }
        }

        `when`("단건 조회 결과로 내보내면") {
            val port = mockk<AttractionSearchPort>()
            documents.forEach { (id, doc) -> every { port.findById(id) } returns doc }
            val service = SearchAttractionService(
                port, mockk<ResolveQueryVectorUseCase>(relaxed = true),
                object : CategoryLexiconUseCase {
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

            then("출처·공공누리 유형·요금 텍스트·반려동물 원문이 상세 결과까지 남는다") {
                documents.keys.forEach { id ->
                    val doc = documents.getValue(id)
                    val result = service.findById(id)!!
                    (id to listOf(result.source, result.copyrightDivCd, result.feeText, result.petAcmpyType)) shouldBe
                        (id to listOf(doc.source, doc.copyrightDivCd, doc.feeText, doc.petAcmpyType))
                }
                service.findById("202")!!.copyrightDivCd shouldBe "Type3"
            }

            then("언어 대체 짝·본문 변경 시각이 쓰기 문서 값 그대로 상세 결과까지 남는다") {
                val written = ObjectMapper().readTree(
                    AttractionReindexCaptureTest::class.java.getResource("/attraction/reindex-capture.json")!!.readText(),
                ).path("documents").associate { it.path("id").asString() to it }
                fun writtenText(id: String, field: String) = written.getValue(id).path(field).takeIf { it.isString }?.asString()
                documents.keys.forEach { id ->
                    val result = service.findById(id)!!
                    (id to result.alternateId) shouldBe (id to writtenText(id, "alternateId"))
                    (id to result.contentUpdatedAt) shouldBe (id to writtenText(id, "contentUpdatedAt")?.let(LocalDateTime::parse))
                }
                // 대조군: 짝이 양방향으로 실려 있고 시각이 실린 문서가 있어야 위 비교가 무언가를 잰다
                service.findById("601")!!.alternateId shouldBe "602"
                service.findById("602")!!.alternateId shouldBe "601"
                documents.values.count { it.contentUpdatedAt != null } shouldBe 1
            }

            then("찜 수·근거 기준일이 쓰기 문서 값 그대로 상세·목록 결과까지 남는다") {
                val written = ObjectMapper().readTree(
                    AttractionReindexCaptureTest::class.java.getResource("/attraction/reindex-capture.json")!!.readText(),
                ).path("documents").associate { it.path("id").asString() to it }
                documents.keys.forEach { id ->
                    val result = service.findById(id)!!
                    val savedNode = written.getValue(id).path("savedCount")
                    (id to result.savedCount) shouldBe (id to savedNode.takeIf { it.isNumber }?.asInt())
                    (id to result.signalsAsOf) shouldBe
                        (id to written.getValue(id).path("signalsAsOf").takeIf { it.isString }?.asString()?.let(LocalDate::parse))
                }
                // 대조군: 쓰기 쪽이 201 에 4명을 실었고(202 의 2명은 하한 미만이라 없다) 기준일은 재색인일(KST)이다
                service.findById("201")!!.savedCount shouldBe 4
                service.findById("202")!!.savedCount shouldBe null
                service.findById("201")!!.signalsAsOf shouldBe LocalDate.of(2026, 10, 2)
            }

            then("가까운 역·정류장이 상세 결과까지 남는다") {
                documents.keys.forEach { id ->
                    val expected = expectedAccess(id)?.let { a ->
                        SearchAttractionUseCase.Access(
                            a.stops.map { SearchAttractionUseCase.AccessStop(it.kind.name, it.rank, it.name, it.nameEn, it.lines, it.distanceM, it.baseDate) },
                            a.busCovered,
                        )
                    }
                    (id to service.findById(id)!!.access) shouldBe (id to expected)
                }
                service.findById("203")!!.access!!.stops.first().let { it.name to it.distanceM } shouldBe ("서울역" to 999)
            }

            then("같은 장소의 다른 등록이 상세 결과까지 남는다") {
                service.findById("501")!!.samePlace shouldBe listOf(SearchAttractionUseCase.SamePlaceRef("502", "38"))
                service.findById("201")!!.samePlace shouldBe null
            }

            then("연관 관광지 순위·id·제목·분류가 상세 결과까지 남는다") {
                documents.keys.forEach { id ->
                    (id to service.findById(id)!!.relatedPlaces?.map { Triple(it.rank, it.id, it.title) }) shouldBe (id to expectedRelated(id))
                }
                service.findById("401")!!.relatedPlaces!!.first().category shouldBe "자연경관(하천/해양)"
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
        val relatedPlaces: List<SourceRelated>? = null,
        val access: SourceAccess? = null,
    )

    private data class SourceAccess(val stops: List<SourceAccessStop> = emptyList(), val busCovered: Boolean? = null)

    private data class SourceAccessStop(
        val kind: String,
        val rank: Int,
        val name: String,
        val nameEn: String? = null,
        val lines: String? = null,
        val distanceM: Int,
        val baseDate: String? = null,
    )

    private data class SourceRelated(val rank: Int, val attractionId: Long, val category: String? = null)

    private data class SourceCongestionDay(val date: String, val rate: Double)

    private data class SourceDates(val start: LocalDate?, val end: LocalDate?)
}
