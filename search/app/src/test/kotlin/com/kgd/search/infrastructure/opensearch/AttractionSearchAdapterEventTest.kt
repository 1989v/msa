package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.EventStatus
import com.kgd.search.domain.attraction.model.EventStatusFilter
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.springframework.data.domain.PageRequest
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.time.LocalDate

/**
 * 행사 필터·정렬 — 어댑터가 **내놓는 요청 JSON** 을 본다.
 *
 * 범위 판정은 요청 JSON 의 `range` 를 이 테스트의 작은 해석기로 읽어 문서 하나씩 평가한다. 그 결과를
 * 행사 상태(`EventSchedule.status`)와 손으로 적은 겹침 창에 대조한다 — 어댑터가 범위를 한 칸 틀리게
 * 옮기면(gte↔gt, 필드 뒤바뀜) 경계 문서에서 어긋난다.
 * 필터·정렬이 없는 요청은 행사 필터를 넣기 전 커밋에서 뜬 기준 JSON 과 바이트 단위로 같아야 한다.
 */
class AttractionSearchAdapterEventTest : BehaviorSpec({

    val json = ObjectMapper()

    /** 2026-10-07 수요일. 이번 주 토·일은 10-10·10-11, 이번 달 말일은 10-31. */
    val today = LocalDate.of(2026, 10, 7)

    fun baseline(dir: String, name: String): String =
        requireNotNull(javaClass.getResource("/$dir/$name.json")) { "기준 스냅샷 없음: $dir/$name" }.readText()

    fun mainRequest(query: AttractionSearchPort.SearchQuery): JsonNode {
        val (a, captured) = AttractionSearchRequestSnapshots.adapter()
        a.search(query, PageRequest.of(0, 20))
        return json.readTree(captured.main.single().toJsonString())
    }

    /** 「행사가 아니거나 범위 안」 bool — should 에 contentTypeId must_not 이 있는 bool. 없으면 null. */
    fun bools(node: JsonNode): List<JsonNode> = buildList {
        // findValues 는 찾은 노드 아래로 내려가지 않아 중첩 bool 을 놓친다 — 직접 훑는다
        fun walk(n: JsonNode) {
            if (n.isObject) n.properties().forEach { (k, v) -> if (k == "bool") add(v); walk(v) }
            if (n.isArray) n.forEach(::walk)
        }
        walk(node)
    }

    fun eventFilters(root: JsonNode): List<JsonNode> =
        bools(root).filter { b ->
            b["should"]?.any { s -> s["bool"]?.get("must_not")?.any { it["terms"]?.has("contentTypeId") == true } == true } == true
        }

    fun date(node: JsonNode?): LocalDate? = node?.asString()?.let(LocalDate::parse)

    /** `range` 하나를 문서 값에 대 본다. 필드가 없는 문서(날짜 없음)는 범위 질의에 걸리지 않는다. */
    fun rangeHolds(range: JsonNode, period: EventPeriod?): Boolean {
        val (field, bounds) = range.properties().single().let { it.key to it.value }
        val value = when (field) {
            "eventStartEffective" -> period?.start
            "eventEndEffective" -> period?.end
            else -> error("모르는 범위 필드: $field")
        } ?: return false
        date(bounds["gte"])?.let { if (value.isBefore(it)) return false }
        date(bounds["lte"])?.let { if (value.isAfter(it)) return false }
        date(bounds["gt"])?.let { if (!value.isAfter(it)) return false }
        date(bounds["lt"])?.let { if (!value.isBefore(it)) return false }
        return true
    }

    /** 요청의 행사 조건이 문서(유형 · 유효 기간)를 들이는가 — should 절 중 하나라도 맞으면. */
    fun admits(filter: JsonNode, contentTypeId: String, period: EventPeriod?): Boolean {
        filter["minimum_should_match"].asString() shouldBe "1"
        return filter["should"].any { clause ->
            val bool = clause["bool"]
            when {
                bool.has("must_not") -> bool["must_not"].none { n ->
                    n["terms"]["contentTypeId"].any { it.asString() == contentTypeId }
                }
                else -> bool["filter"].all { rangeHolds(it["range"], period) }
            }
        }
    }

    fun requestFor(filter: EventStatusFilter): JsonNode =
        mainRequest(AttractionSearchPort.SearchQuery(keyword = "축제", lang = "ko", eventRange = EventSchedule.range(filter, today)))

    /** 10-01 ~ 11-05 안의 모든 유효 기간(s ≤ e) — 경계 하루 앞뒤를 다 덮는다. */
    val grid: List<EventPeriod> = run {
        val first = LocalDate.of(2026, 10, 1)
        val days = (0L..35L).map { first.plusDays(it) }
        days.flatMap { s -> days.filter { !it.isBefore(s) }.map { e -> EventPeriod(s, e) } }
    }

    fun overlaps(p: EventPeriod, from: LocalDate, to: LocalDate) = !p.start.isAfter(to) && !p.end.isBefore(from)

    /** 필터별 기대 — 상태 셋은 `EventSchedule.status`, 겹침 둘은 손으로 적은 창. */
    val expected: Map<EventStatusFilter, (EventPeriod) -> Boolean> = mapOf(
        EventStatusFilter.ONGOING to { p -> EventSchedule.status(p, today) == EventStatus.ONGOING },
        EventStatusFilter.UPCOMING to { p -> EventSchedule.status(p, today) == EventStatus.UPCOMING },
        EventStatusFilter.NOT_ENDED to { p -> EventSchedule.status(p, today) in setOf(EventStatus.ONGOING, EventStatus.UPCOMING) },
        EventStatusFilter.WEEKEND to { p -> overlaps(p, LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11)) },
        EventStatusFilter.THIS_MONTH to { p -> overlaps(p, today, LocalDate.of(2026, 10, 31)) },
    )

    given("행사 필터·정렬이 없는 요청") {
        AttractionSearchBaselineQueries.cases.forEach { (name, case) ->
            then("본 질의 [$name] 은 기준 JSON 과 바이트 단위로 같다") {
                val (a, captured) = AttractionSearchRequestSnapshots.adapter()
                a.search(case.first, case.second)
                captured.main.single().toJsonString() shouldBe baseline("attraction-search-baseline", name)
            }
        }
        AttractionSearchRequestSnapshots.cases.forEach { (name, produce) ->
            then("[$name] 은 기준 JSON 과 바이트 단위로 같다") {
                produce() shouldBe baseline("attraction-search-baseline-event", name)
            }
        }
    }

    given("eventStatus 다섯 값") {
        then("범위는 받은 날짜 그대로 gte·lte 로 실린다") {
            fun ranges(f: EventStatusFilter): Map<String, Map<String, String>> =
                eventFilters(requestFor(f)).single()["should"][1]["bool"]["filter"].associate { r ->
                    val (field, bounds) = r["range"].properties().single().let { it.key to it.value }
                    field to bounds.properties().associate { it.key to it.value.asString() }
                }
            ranges(EventStatusFilter.ONGOING) shouldBe mapOf(
                "eventStartEffective" to mapOf("lte" to "2026-10-07"),
                "eventEndEffective" to mapOf("gte" to "2026-10-07"),
            )
            ranges(EventStatusFilter.UPCOMING) shouldBe mapOf("eventStartEffective" to mapOf("gte" to "2026-10-08"))
            ranges(EventStatusFilter.NOT_ENDED) shouldBe mapOf("eventEndEffective" to mapOf("gte" to "2026-10-07"))
            ranges(EventStatusFilter.WEEKEND) shouldBe mapOf(
                "eventStartEffective" to mapOf("lte" to "2026-10-11"),
                "eventEndEffective" to mapOf("gte" to "2026-10-10"),
            )
            ranges(EventStatusFilter.THIS_MONTH) shouldBe mapOf(
                "eventStartEffective" to mapOf("lte" to "2026-10-31"),
                "eventEndEffective" to mapOf("gte" to "2026-10-07"),
            )
        }

        EventStatusFilter.entries.forEach { f ->
            then("[$f] 요청이 들이는 행사 ⇔ 그 필터의 상태·겹침 조건 (기간 ${grid.size}개)") {
                val filter = eventFilters(requestFor(f)).single()
                val wrong = grid.filter { p -> admits(filter, "15", p) != expected.getValue(f)(p) }
                wrong.shouldBeEmpty()
            }
            then("[$f] 날짜 없는 행사(국·영)는 빠지고 행사가 아닌 문서는 날짜가 없어도 들어온다") {
                val filter = eventFilters(requestFor(f)).single()
                admits(filter, "15", null) shouldBe false
                admits(filter, "85", null) shouldBe false
                admits(filter, "12", null) shouldBe true
                admits(filter, "25", null) shouldBe true
                // 영문 행사도 같은 범위를 탄다
                grid.filter { admits(filter, "85", it) != expected.getValue(f)(it) }.shouldBeEmpty()
            }
        }

        then("하이브리드면 두 레그(키워드 · knn filter) 모두에 걸린다") {
            val root = mainRequest(
                AttractionSearchPort.SearchQuery(
                    keyword = "축제", lang = "ko", embedding = AttractionSearchBaselineQueries.VECTOR,
                    eventRange = EventSchedule.range(EventStatusFilter.NOT_ENDED, today),
                ),
            )
            eventFilters(root) shouldHaveSize 2
            eventFilters(root["query"]["hybrid"]["queries"][1]["knn"]) shouldHaveSize 1
        }

        then("속성 패싯 건수 요청에도 같은 조건이 걸린다") {
            val (a, captured) = AttractionSearchRequestSnapshots.adapter()
            a.search(
                AttractionSearchPort.SearchQuery(
                    keyword = "축제", lang = "ko",
                    eventRange = EventSchedule.range(EventStatusFilter.NOT_ENDED, today),
                    attributes = com.kgd.search.domain.attraction.model.AttributeSelection(today = java.time.DayOfWeek.WEDNESDAY),
                    countAttributeFacets = true,
                ),
                PageRequest.of(0, 20),
            )
            eventFilters(json.readTree(captured.count.single().toJsonString())) shouldHaveSize 1
        }
    }

    given("sort=eventStart") {
        then("유효 시작일 오름차순 · 날짜 없음은 뒤 · 같으면 idSort·id 오름차순") {
            val root = mainRequest(
                AttractionSearchPort.SearchQuery(
                    lang = "ko", categories = listOf("festival"),
                    eventRange = EventSchedule.range(EventStatusFilter.NOT_ENDED, today), sortByEventStart = true,
                ),
            )
            val sort = root["sort"]
            sort.size() shouldBe 3
            sort[0]["eventStartEffective"]["order"].asString() shouldBe "asc"
            sort[0]["eventStartEffective"]["missing"].asString() shouldBe "_last"
            sort[1]["idSort"]["order"].asString() shouldBe "asc"
            sort[2]["id"]["order"].asString() shouldBe "asc"
        }
        then("반경 안에서도 거리 대신 시작일로 정렬한다") {
            val root = mainRequest(
                AttractionSearchPort.SearchQuery(
                    lang = "ko", geo = AttractionSearchPort.GeoFilter(37.5, 127.0, 20.0),
                    eventRange = EventSchedule.range(EventStatusFilter.NOT_ENDED, today), sortByEventStart = true,
                ),
            )
            root["sort"][0].has("eventStartEffective") shouldBe true
            root["sort"].none { it.has("_geo_distance") } shouldBe true
        }
        then("벡터와 함께 줄 수 없다 — 정렬이 점수를 버리고 하이브리드는 정렬을 받지 않는다") {
            shouldThrow<IllegalArgumentException> {
                AttractionSearchPort.SearchQuery(keyword = "축제", embedding = listOf(1f), sortByEventStart = true)
            }
        }
    }

    given("자동완성") {
        val notEnded = EventSchedule.range(EventStatusFilter.NOT_ENDED, today)

        then("관광지 질의에 「행사가 아니거나 NOT_ENDED」가 걸린다") {
            val (a, captured) = AttractionSearchRequestSnapshots.adapter()
            a.suggest("머드", "ko", 8, notEnded)
            val filter = eventFilters(json.readTree(captured.main.single().toJsonString())).single()
            grid.filter { admits(filter, "15", it) != expected.getValue(EventStatusFilter.NOT_ENDED)(it) }.shouldBeEmpty()
            admits(filter, "12", null) shouldBe true
        }
        then("행사 조건 말고는 변경 전 요청과 같다 — 지역 질의는 바이트 동일") {
            val (a, captured) = AttractionSearchRequestSnapshots.adapter()
            a.suggest("경복", "ko", 8, notEnded)
            captured.regions.single().toJsonString() shouldBe baseline("attraction-search-baseline-event", "suggest-regions-ko")
            val now = captured.main.single().toJsonString()
            now shouldNotBe baseline("attraction-search-baseline-event", "suggest-attractions-ko")
            // 행사 조건을 떼어 내면 변경 전과 같다
            val tree = json.readTree(now)
            val bool = tree["query"]["function_score"]["query"]["bool"]
            val filters = bool["filter"] as tools.jackson.databind.node.ArrayNode
            filters.size() shouldBe 2
            filters.remove(1)
            tree.toString() shouldBe json.readTree(baseline("attraction-search-baseline-event", "suggest-attractions-ko")).toString()
        }
    }
    given("통합 검색의 관광지 묶음 — 통합 → 관광지 서비스 → 어댑터, 시계 2026-10-07 02:00 KST") {
        val sent = json.readTree(UnifiedAttractionRequests.request())

        then("끝난 행사(15)는 빠지고 진행 중 행사와 관광지(12)는 들어온다") {
            val filter = eventFilters(sent).single()
            admits(filter, "15", EventPeriod(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5))) shouldBe false
            // UTC 날짜(10-06)로 세면 아직 진행 중으로 보이는 행사 — KST 로는 어제 끝났다
            admits(filter, "15", EventPeriod(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 6))) shouldBe false
            admits(filter, "15", EventPeriod(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 7))) shouldBe true
            admits(filter, "15", EventPeriod(LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 21))) shouldBe true
            admits(filter, "12", null) shouldBe true
        }
        then("행사 조건을 떼어 내면 변경 전 통합 검색 요청과 같다") {
            val bool = sent["query"]["function_score"]["query"]["bool"] as tools.jackson.databind.node.ObjectNode
            bool["filter"].size() shouldBe 1
            bool.remove("filter")
            sent.toString() shouldBe json.readTree(baseline("attraction-search-baseline-event", "unified-attraction")).toString()
        }
    }
})
