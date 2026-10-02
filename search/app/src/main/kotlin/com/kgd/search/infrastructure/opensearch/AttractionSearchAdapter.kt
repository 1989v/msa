package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.AttractionAttributeCodes
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttributeFacetCounts
import com.kgd.search.domain.attraction.model.AttributeSelection
import com.kgd.search.domain.attraction.model.Availability
import com.kgd.search.domain.attraction.model.EventDateRange
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.ClosureState
import com.kgd.search.domain.attraction.model.Jamo
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.SuggestHit
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.json.JsonData
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.SortOrder
import org.opensearch.client.opensearch._types.SuggestMode
import org.opensearch.client.opensearch._types.aggregations.Aggregation
import org.opensearch.client.opensearch._types.mapping.FieldType
import org.opensearch.client.opensearch._types.query_dsl.FieldValueFactorModifier
import org.opensearch.client.opensearch._types.query_dsl.FunctionBoostMode
import org.opensearch.client.opensearch._types.query_dsl.FunctionScoreMode
import org.opensearch.client.opensearch._types.query_dsl.Operator
import org.opensearch.client.opensearch._types.query_dsl.HybridQuery
import org.opensearch.client.opensearch._types.query_dsl.KnnQuery
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.opensearch.client.opensearch.core.SearchRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component
import java.time.DayOfWeek
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

private val log = KotlinLogging.logger {}

@Component
class AttractionSearchAdapter(
    private val client: OpenSearchClient,
    private val ranking: AttractionRankingProperties,
    private val hybrid: AttractionHybridProperties,
    private val queryVector: QueryVectorProperties,
    private val clickBoost: AttractionClickBoostProperties = AttractionClickBoostProperties(),
) : AttractionSearchPort {

    companion object {
        const val INDEX = "attractions"
        const val REGIONS_INDEX = "regions"

        /** 자동완성에서 지역이 차지하는 상단 슬롯 수 — "서울" 같은 지역 질의 우선 노출 */
        private const val SUGGEST_REGION_SLOTS = 3

        /**
         * 키워드 매칭 대상 — ko(nori)/en(english) 서브필드 동시 커버 (문서 단위 lang 분리, ADR-0065).
         * titleLocal 은 표시명에서 분리된 다른 표기(영문 문서의 국문명) — "도산공원" 질의가
         * `Dosan Park` 영문 문서를 찾는 리콜 축이라 title 과 같은 무게를 준다.
         */
        private val KEYWORD_FIELDS = listOf(
            "title^3", "title.en^3", "titleLocal^3", "overview", "overview.en", "address", "address.en",
        )
        private const val EARTH_RADIUS_KM = 6371.0

        /**
         * 벡터 필드는 **응답에서만** 뺀다 (ADR-0090). 매핑 `_source.excludes` 로 빼면 인덱스가
         * 3.4배 커진다 — k-NN 플러그인이 벡터를 다른 형태로 다시 저장하기 때문이다(플랜 §8.4 실측).
         * 하이브리드가 꺼져 있어도 뺀다: 필드는 이미 `_source` 에 있고, 문서당 4KB 를 그냥 실어 보낼 이유가 없다.
         */
        private const val VECTOR_FIELD = "embedding"

        /** 제목을 자모로 편 단어 사전 — 오타 교정 제안의 출처 (색인 매핑 `titleJamo.spell`) */
        private const val SPELL_FIELD = "titleJamo.spell"
        private const val SPELL_SUGGESTER = "spell"
        /** 두 글자 미만은 고치지 않는다 — 한 글자 단어는 편집거리 2 안에 후보가 너무 많다 */
        private const val SPELL_MIN_CHARS = 2
        /** 제안 유사도 하한. 실측: 경복굼→경복궁 0.89 · haeundea→haeundae 0.88, 엉뚱한 제안은 0.6~0.8 */
        private const val SPELL_MIN_SCORE = 0.85
        private val WHITESPACE = Regex("\\s+")

        /**
         * 속성 패싯 건수를 기다리는 한도. 본 질의가 끝난 뒤부터 잰다 — 건수가 늦으면 건수 없이 결과를 낸다.
         * 건수는 칩 옆 숫자일 뿐이라 결과를 붙잡아 둘 값이 아니다.
         */
        private const val FACET_WAIT_MS = 1_000L

        /** 건수 요청은 블로킹 IO 한 번이라 가상 스레드로 낸다 — 풀 크기를 정할 일이 없다. */
        private val facetExecutor = Executors.newVirtualThreadPerTaskExecutor()

        // 속성 필드 이름은 읽기 문서의 속성 이름을 그대로 쓴다 — 색인 계약 게이트가 그 이름을 매핑과 대조한다.
        private val CLOSURE_STATE = AttractionSearchDocument::closureState.name
        private val CLOSED_WEEKDAYS = AttractionSearchDocument::closedWeekdays.name
        private val PARKING = AttractionSearchDocument::attrParking.name
        private val CREDIT_CARD = AttractionSearchDocument::attrCreditCard.name
        private val STROLLER_RENTAL = AttractionSearchDocument::attrStrollerRental.name
        private val PET_POLICY = AttractionSearchDocument::petPolicy.name
        private val ADMISSION = AttractionSearchDocument::attrAdmission.name

        /** 읽기 문서는 이 필드를 읽지 않는다(순위 전용) — 이름은 쓰기 문서·매핑과 같다. */
        private const val CLICK_BOOST = "clickBoost"

        private val CONTENT_TYPE_ID = AttractionSearchDocument::contentTypeId.name
        private val EVENT_START = AttractionSearchDocument::eventStartEffective.name
        private val EVENT_END = AttractionSearchDocument::eventEndEffective.name
    }

    /** 속성 패싯의 속성 — 건수에서 「자기 선택만 뺀다」의 단위다. 반려동물 두 값은 한 속성이다. */
    private enum class Facet { OPEN_TODAY, PARKING, CREDIT_CARD, STROLLER_RENTAL, PET, ADMISSION }

    /** 건수 버킷 하나 — 집계 이름 · 속한 속성 · 그 값의 조건. */
    private class Bucket(val name: String, val facet: Facet, val condition: Query)

    override fun search(
        query: AttractionSearchPort.SearchQuery,
        pageable: Pageable,
    ): AttractionSearchPort.SearchResult {
        // 건수 요청을 먼저 띄우고 본 질의를 낸다 — 둘이 병렬로 돈다.
        val facets = query.attributes?.takeIf { query.countAttributeFacets }?.let { selection ->
            CompletableFuture.supplyAsync({ countFacets(query, selection) }, facetExecutor)
        }
        val request = buildRequest(query, pageable)
        val response = client.search(request, AttractionSearchDocument::class.java)
        val content = response.hits().hits().mapNotNull { hit ->
            hit.source()?.let { source ->
                val document = source.toDomain()
                AttractionSearchPort.AttractionHit(
                    document = document,
                    score = hit.score() ?: 0.0,
                    distanceKm = query.geo?.let {
                        haversineKm(it.latitude, it.longitude, document.latitude, document.longitude)
                    },
                )
            }
        }
        return AttractionSearchPort.SearchResult(
            page = PageImpl(content, pageable, response.hits().total()?.value() ?: 0L),
            attributeFacets = facets?.let(::awaitFacets),
        )
    }

    /** 건수는 결과의 부속이다 — 실패·지연은 경고만 남기고 건수 없이 간다. */
    private fun awaitFacets(future: Future<AttributeFacetCounts>): AttributeFacetCounts? =
        try {
            future.get(FACET_WAIT_MS, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            future.cancel(true)
            log.warn { "속성 패싯 건수가 ${FACET_WAIT_MS}ms 안에 오지 않아 건수 없이 결과를 낸다" }
            null
        } catch (e: ExecutionException) {
            log.warn(e.cause ?: e) { "속성 패싯 건수 요청 실패 — 건수 없이 결과를 낸다" }
            null
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            null
        }

    /**
     * 속성 패싯 건수 — 결과 0건 요청 하나에 값마다 `filter` 집계를 둔다.
     *
     * 최상위 질의는 구조 필터(언어·지역·분류·반경·질의 이해 분류)다. 텍스트 경로는 질의어도 넣고,
     * 벡터 레그가 있는 경로(하이브리드·벡터 단독)는 질의어를 뺀다 — 벡터 결과는 텍스트 일치로 셀 수 없다.
     * 각 버킷은 **자기 속성의 선택만 빼고** 나머지 선택을 건다(「이 조건을 더하면 몇 곳」).
     */
    private fun countFacets(query: AttractionSearchPort.SearchQuery, selection: AttributeSelection): AttributeFacetCounts {
        val selected = selectedAttributeFilters(selection)
        val buckets = facetBuckets(selection.today)
        val request = SearchRequest.Builder()
            .index(INDEX)
            .size(0)
            .query(matchedQuery(query, keyword = query.keyword.takeIf { query.embedding == null }, attributeFilters = emptyList()))
            .aggregations(
                buckets.associate { bucket ->
                    val others = selected.filterKeys { it != bucket.facet }.values.toList()
                    bucket.name to Aggregation.of { a -> a.filter { f -> f.bool { b -> b.filter(others + bucket.condition) } } }
                },
            )
            .build()
        val aggregations = client.search(request, JsonData::class.java).aggregations()
        val counts = buckets.associate { bucket ->
            bucket.name to requireNotNull(aggregations[bucket.name]) { "건수 응답에 ${bucket.name} 집계가 없다" }.filter().docCount()
        }
        return AttributeFacetCounts(
            openToday = counts.getValue(buckets.single { it.facet == Facet.OPEN_TODAY }.name),
            parking = counts.getValue(buckets.single { it.facet == Facet.PARKING }.name),
            creditCard = counts.getValue(buckets.single { it.facet == Facet.CREDIT_CARD }.name),
            strollerRental = counts.getValue(buckets.single { it.facet == Facet.STROLLER_RENTAL }.name),
            pet = AttributeSelection.PET_CHOICES.associateWith { counts.getValue(petBucketName(it)) },
            freeAdmission = counts.getValue(buckets.single { it.facet == Facet.ADMISSION }.name),
        )
    }

    /** 고른 속성 → 본 질의에 거는 필터(속성 사이 AND). 긍정 값만 만든다 — 부정·`UNKNOWN` 필터는 여기서 나올 수 없다. */
    private fun selectedAttributeFilters(selection: AttributeSelection): Map<Facet, Query> = buildMap {
        if (selection.openToday) put(Facet.OPEN_TODAY, openTodayFilter(selection.today))
        if (selection.parking) put(Facet.PARKING, termFilter(PARKING, Availability.YES.name))
        if (selection.creditCard) put(Facet.CREDIT_CARD, termFilter(CREDIT_CARD, Availability.YES.name))
        if (selection.strollerRental) put(Facet.STROLLER_RENTAL, termFilter(STROLLER_RENTAL, Availability.YES.name))
        if (selection.pet.isNotEmpty()) {
            val values = AttributeSelection.PET_CHOICES.filter { it in selection.pet }.map { FieldValue.of(it.name) }
            put(Facet.PET, Query.of { q -> q.terms { t -> t.field(PET_POLICY).terms { tv -> tv.value(values) } } })
        }
        if (selection.freeAdmission) put(Facet.ADMISSION, termFilter(ADMISSION, Admission.FREE.name))
    }

    /** 건수를 내는 값 — 긍정 값뿐이다(`UNKNOWN` 버킷은 없다). 이름은 `{속성}_{값}`. */
    private fun facetBuckets(today: DayOfWeek): List<Bucket> =
        listOf(
            Bucket("openToday", Facet.OPEN_TODAY, openTodayFilter(today)),
            Bucket("parking_${Availability.YES.name}", Facet.PARKING, termFilter(PARKING, Availability.YES.name)),
            Bucket("creditCard_${Availability.YES.name}", Facet.CREDIT_CARD, termFilter(CREDIT_CARD, Availability.YES.name)),
            Bucket(
                "strollerRental_${Availability.YES.name}",
                Facet.STROLLER_RENTAL,
                termFilter(STROLLER_RENTAL, Availability.YES.name),
            ),
        ) +
            AttributeSelection.PET_CHOICES.map { Bucket(petBucketName(it), Facet.PET, termFilter(PET_POLICY, it.name)) } +
            Bucket("admission_${Admission.FREE.name}", Facet.ADMISSION, termFilter(ADMISSION, Admission.FREE.name))

    private fun petBucketName(policy: PetPolicy) = "pet_${policy.name}"

    /**
     * 「오늘 정기휴무 아님」 — 연중무휴 · 매주 쉬는 요일 없음 · 매주 휴무이되 오늘(KST)이 휴무 요일에 없음.
     * `UNKNOWN` 은 어느 쪽에도 걸리지 않아 빠진다.
     */
    private fun openTodayFilter(today: DayOfWeek): Query = Query.of { q ->
        q.bool { b ->
            b.should { s ->
                s.terms { t ->
                    t.field(CLOSURE_STATE).terms { tv ->
                        tv.value(listOf(ClosureState.ALWAYS_OPEN, ClosureState.NO_WEEKLY).map { FieldValue.of(it.name) })
                    }
                }
            }
            b.should { s ->
                s.bool { weekly ->
                    weekly.filter(termFilter(CLOSURE_STATE, ClosureState.WEEKLY.name))
                    weekly.mustNot(termFilter(CLOSED_WEEKDAYS, AttractionAttributeCodes.weekdayCode(today)))
                }
            }
            b.minimumShouldMatch("1")
        }
    }

    private fun termFilter(field: String, value: String): Query =
        Query.of { q -> q.term { it.field(field).value(FieldValue.of(value)) } }

    override fun findById(id: String): AttractionDocument? {
        val response = client.get({ g -> g.index(INDEX).id(id) }, AttractionSearchDocument::class.java)
        return if (response.found()) response.source()?.toDomain() else null
    }

    /**
     * 통합 자동완성 — 지역(상단 슬롯, 인구 log1p 부스트) + 관광지(prefix, lang 필터).
     * match_bool_prefix 라 별도 completion 매핑 없이 동작한다 (products suggest 패턴).
     */
    override fun suggest(prefix: String, lang: String?, size: Int, eventRange: EventDateRange): List<SuggestHit> {
        val regionSlots = minOf(SUGGEST_REGION_SLOTS, size)
        val regions = suggestRegions(prefix, lang, regionSlots)
        val attractions = suggestAttractions(prefix, lang, size - regions.size, eventRange)
        return regions + attractions
    }

    private fun suggestRegions(prefix: String, lang: String?, size: Int): List<SuggestHit> {
        if (size <= 0) return emptyList()
        val request = SearchRequest.Builder()
            .index(REGIONS_INDEX)
            .query { q ->
                q.functionScore { fs ->
                    fs.query { inner ->
                        inner.bool { b ->
                            b.should { s -> s.matchBoolPrefix { it.field("nameKo").query(prefix) } }
                            b.should { s -> s.matchBoolPrefix { it.field("name").query(prefix) } }
                            b.minimumShouldMatch("1")
                        }
                    }
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf ->
                            fvf.field("population").factor(1.0f)
                                .modifier(FieldValueFactorModifier.Log1p).missing(0.0)
                        }
                        fn.weight(1.0f)
                    }
                    fs.boostMode(FunctionBoostMode.Sum)
                }
            }
            .size(size)
            .build()
        return client.search(request, RegionSearchDocument::class.java).hits().hits().mapNotNull { hit ->
            hit.source()?.let { doc ->
                SuggestHit(
                    type = SuggestHit.Type.REGION,
                    id = doc.id,
                    title = if (lang == "en") doc.name else doc.nameKo ?: doc.name,
                    latitude = doc.location?.lat,
                    longitude = doc.location?.lon,
                    regionLevel = doc.level,
                )
            }
        }
    }

    /**
     * 오타 교정 — 단어마다 두 단계를 거친다.
     *  1. 검색 필드 어디에도 없는 단어만 후보다. 제목에만 없는 단어(「야경」)까지 고치면 제대로 친
     *     질의를 망가뜨린다 — 제목 사전만 보면 「야경」 을 「유경」 으로 바꾼다(2026-09-27 실측).
     *  2. 후보를 자모로 펴서 제목 자모 사전(`titleJamo.spell`)에서 편집거리 2 안의 표기를 찾는다.
     *     음절 단위로 재면 「굼」→「궁」 이 한 글자 전체라 멀지만, 자모로는 한 획(ㅁ→ㅇ)이다.
     * 사전 필드가 아직 없는 색인(재색인 전)이면 예외 대신 교정 없음으로 돌아간다.
     */
    override fun correct(keyword: String, lang: String?): String? {
        val words = keyword.trim().split(WHITESPACE).filter { it.isNotEmpty() }
        val fixes = words
            .filter { it.length >= SPELL_MIN_CHARS && countMatches(it, lang) == 0L }
            .mapNotNull { word -> closestTitleSpelling(word)?.let { word to it } }
            .toMap()
        if (fixes.isEmpty()) return null
        return words.joinToString(" ") { fixes[it] ?: it }
    }

    private fun countMatches(word: String, lang: String?): Long {
        val query = Query.of { q ->
            q.bool { b ->
                b.must { m -> m.multiMatch { it.query(word).fields(KEYWORD_FIELDS).operator(Operator.And) } }
                lang?.let { l -> b.filter { f -> f.term { it.field("lang").value(FieldValue.of(l)) } } }
                b
            }
        }
        return client.count { it.index(INDEX).query(query) }.count()
    }

    private fun closestTitleSpelling(word: String): String? = runCatching {
        val response = client.search(
            { s ->
                s.index(INDEX).size(0).suggest { sg ->
                    sg.suggesters(SPELL_SUGGESTER) { fs ->
                        fs.text(Jamo.decompose(word)).term { t ->
                            t.field(SPELL_FIELD)
                                .suggestMode(SuggestMode.Missing)
                                .maxEdits(2)
                                .prefixLength(1)
                                .minWordLength(4)
                                .size(1)
                        }
                    }
                }
            },
            AttractionSearchDocument::class.java,
        )
        response.suggest()[SPELL_SUGGESTER].orEmpty()
            .firstOrNull { it.isTerm }?.term()?.options()
            ?.firstOrNull { it.score() >= SPELL_MIN_SCORE }
            ?.let { Jamo.compose(it.text()) }
            ?.takeIf { it != word }
    }.getOrNull()

    private fun suggestAttractions(prefix: String, lang: String?, size: Int, eventRange: EventDateRange): List<SuggestHit> {
        if (size <= 0) return emptyList()
        val titleField = if (lang == "en") "title.en" else "title"
        /*
         * 세 신호를 **가중치로 눌러** 섞는다. must 가 아니라 should + minimumShouldMatch(1) 인 이유:
         * 자모로만 맞는 입력("경보")을 must 가 걸러버리면 자모 색인이 아무 일도 하지 못한다.
         *
         *  ×6  이름이 입력으로 시작        `경복궁` vs `한복남 경복궁점`
         *  ×1  형태소 기준 일반 매칭        기존 동작
         *  ×0.3 자모(조합 중간 상태)        `경보` → `ㄱㅕㅇㅂㅗ`
         *
         * 자모를 낮게 두는 건 그게 **가장 헐거운 신호**라서다. 같은 무게로 두면 자모로만 스치는
         * 문서가 이름이 정확히 맞는 문서를 밀어낸다 — 자동완성에서 제일 나쁜 실패다.
         */
        val matched = Query.of { q ->
            q.bool { b ->
                b.should { s -> s.matchBoolPrefix { it.field(titleField).query(prefix).boost(1.0f) } }
                /*
                 * 분류 가중치만으로는 "경복" 에서 `한복남 경복궁점` 을 못 내린다 — 그 상점의
                 * TourAPI 분류가 `culture` 라 경복궁과 같은 가중치를 받기 때문이다. 분류 체계가
                 * 새는 지점이고, 거기에 맞서는 신호는 분류가 아니라 **이름의 모양**이다.
                 */
                b.should { s -> s.prefix { p -> p.field("title.keyword").value(prefix).boost(6.0f) } }
                b.should { s ->
                    s.match { m ->
                        m.field("titleJamo")
                            .query(FieldValue.of(Jamo.decompose(prefix)))
                            // 여러 단어를 쳤으면 전부 맞아야 한다 — 하나만 스친 결과가 올라오면
                            // 자모의 헐거움이 그대로 순위에 샌다.
                            .operator(Operator.And)
                            .boost(0.3f)
                    }
                }
                b.minimumShouldMatch("1")
                lang?.let { l -> b.filter { f -> f.term { it.field("lang").value(FieldValue.of(l)) } } }
                b.filter(eventFilter(eventRange))
                b
            }
        }
        val request = SearchRequest.Builder()
            .index(INDEX)
            // 자동완성은 질의 이해를 안 거친다 — 하향은 늘 건다
            .query(withCategoryWeights(matched, commerceIntent = false))
            .size(size)
            .build()
        return client.search(request, AttractionSearchDocument::class.java).hits().hits().mapNotNull { hit ->
            hit.source()?.let { doc ->
                SuggestHit(
                    type = SuggestHit.Type.ATTRACTION,
                    id = doc.id,
                    title = doc.title,
                    titleLocal = doc.titleLocal,
                    latitude = doc.location.lat,
                    longitude = doc.location.lon,
                    category = doc.category,
                )
            }
        }
    }

    /**
     * 검색어 + 구조 필터(언어·지역·분류·질의 이해 분류·반경) + 속성 필터. 속성 필터는 **맨 뒤에** 붙는다 —
     * 속성이 없는 요청이 패싯 이전과 바이트 단위로 같은 요청을 내게 하기 위해서다.
     */
    private fun matchedQuery(
        query: AttractionSearchPort.SearchQuery,
        keyword: String?,
        attributeFilters: List<Query>,
    ): Query = Query.of { q ->
        q.bool { b ->
            if (keyword != null) {
                b.must { m -> m.multiMatch { mm -> mm.query(keyword).fields(KEYWORD_FIELDS) } }
            } else {
                b.must { m -> m.matchAll { it } }
            }
            query.lang?.let { lang ->
                b.filter { f -> f.term { it.field("lang").value(FieldValue.of(lang)) } }
            }
            query.areaCode?.let { area ->
                b.filter { f -> f.term { it.field("areaCode").value(FieldValue.of(area)) } }
            }
            // 법정동 축 (ADR-0071). 시군구를 주면 시도는 그 앞 2자리라 따로 걸 필요가 없다.
            query.sidoCode?.let { sido ->
                b.filter { f -> f.term { it.field("ldongRegnCd").value(FieldValue.of(sido)) } }
            }
            query.sigunguCode?.let { sigungu ->
                b.filter { f -> f.term { it.field("ldongSignguCd").value(FieldValue.of(sigungu)) } }
            }
            query.categories.takeIf { it.isNotEmpty() }?.let { categories ->
                b.filter { f ->
                    f.terms { t ->
                        t.field("category").terms { tv ->
                            tv.value(categories.map { FieldValue.of(it) })
                        }
                    }
                }
            }
            // 쿼리 언더스탠딩이 유도한 원천 분류 축 (ADR-0090 개정). 코드는 토큰이 아니라 값이라 term 이다.
            query.facets.forEach { (field, value) ->
                b.filter { f -> f.term { it.field(field).value(FieldValue.of(value)) } }
            }
            query.geo?.let { geo ->
                b.filter { f ->
                    f.geoDistance { g ->
                        g.field("location")
                            .distance("${geo.radiusKm}km")
                            .location { loc -> loc.latlon { ll -> ll.lat(geo.latitude).lon(geo.longitude) } }
                    }
                }
            }
            attributeFilters.forEach { b.filter(it) }
            // 속성 필터와 같은 이유로 맨 뒤 — 조건이 없는 요청은 이 필드가 생기기 전과 바이트 단위로 같다.
            query.eventRange?.let { b.filter(eventFilter(it)) }
            b
        }
    }

    /**
     * 「행사가 아니거나 범위 안」. 행사가 아닌 문서는 첫 절로 늘 통과하고, 행사는 유효 기간 필드가 범위에 들어야 한다.
     * 날짜 없는 행사는 필드가 없어 범위 질의에 걸리지 않으므로 빠진다(UNKNOWN 은 어느 행사 필터에도 들지 않는다).
     * 범위 경계는 [EventDateRange] 의 날짜를 그대로 gte·lte 로 옮긴다 — 여기서 날짜를 계산하지 않는다.
     */
    private fun eventFilter(range: EventDateRange): Query = Query.of { q ->
        q.bool { b ->
            b.should { s ->
                s.bool { notEvent ->
                    notEvent.mustNot { m ->
                        m.terms { t ->
                            t.field(CONTENT_TYPE_ID).terms { tv -> tv.value(EventSchedule.EVENT_CONTENT_TYPES.sorted().map { FieldValue.of(it) }) }
                        }
                    }
                }
            }
            b.should { s ->
                s.bool { inRange ->
                    if (range.startGte != null || range.startLte != null) {
                        inRange.filter { f ->
                            f.range { r ->
                                r.field(EVENT_START)
                                range.startGte?.let { r.gte(JsonData.of(it.toString())) }
                                range.startLte?.let { r.lte(JsonData.of(it.toString())) }
                                r
                            }
                        }
                    }
                    range.endGte?.let { endGte ->
                        inRange.filter { f -> f.range { r -> r.field(EVENT_END).gte(JsonData.of(endGte.toString())) } }
                    }
                    inRange
                }
            }
            b.minimumShouldMatch("1")
        }
    }

    private fun buildRequest(query: AttractionSearchPort.SearchQuery, pageable: Pageable): SearchRequest {
        // 속성 필터는 이 bool 에 들어가므로 키워드 레그와 벡터 레그(knn filter) 양쪽에 걸린다.
        val attributeFilters = query.attributes?.let { selectedAttributeFilters(it).values.toList() }.orEmpty()
        val matched = matchedQuery(query, query.keyword, attributeFilters)
        // 클릭 계수는 관련도에 곱하는 값이라 검색어가 있을 때만 붙는다 — 검색어 없는 목록은 완결성 순서 그대로다
        val keywordLeg = withCategoryWeights(
            matched,
            query.commerceIntent,
            withClickBoost = clickBoost.enabled && query.keyword != null,
        )
        val embedding = query.embedding

        val builder = SearchRequest.Builder()
            .index(INDEX)
            .from(pageable.offset.toInt())
            .size(pageable.pageSize)
            // 벡터는 답을 고르는 데 쓰이고 화면에는 안 나간다 — 문서당 4KB 를 실어 보내지 않는다.
            .source { s -> s.filter { f -> f.excludes(VECTOR_FIELD) } }

        if (embedding == null) {
            builder.query(keywordLeg)
        } else if (query.keyword == null) {
            // 검색어가 없으면 키워드 레그는 matchAll 이다 — 그것을 융합하면 **임의 순서**가
            // 벡터 결과와 같은 무게로 섞인다. 순위를 정할 신호가 벡터뿐이니 벡터만 쓴다.
            builder.query(vectorLeg(embedding, matched))
        } else {
            builder.query(hybridQuery(keywordLeg, embedding, matched, pageable.offset.toInt() + pageable.pageSize))
                // 파이프라인이 두 레그의 점수를 융합한다. **이름이 없으면 OpenSearch 가 요청을 거부한다** —
                // 조용히 BM25 로 떨어지지 않는다는 뜻이라, 파이프라인 부재는 즉시 드러난다.
                .searchPipeline(hybrid.pipeline)
        }

        val geo = query.geo
        if (query.sortByEventStart) {
            // 시작일이 같은 행사끼리는 id 순 — 날짜 없는 문서는 맨 뒤. 재색인 전 옛 인덱스에서도 정렬이 깨지지 않게 unmappedType.
            builder.sort { s ->
                s.field { f -> f.field(EVENT_START).order(SortOrder.Asc).unmappedType(FieldType.Date).missing(FieldValue.of("_last")) }
            }
            addTiebreakers(builder)
        } else if (geo != null && geo.sortByDistance) {
            builder.sort { s ->
                s.geoDistance { g ->
                    g.field("location")
                        .location { loc -> loc.latlon { ll -> ll.lat(geo.latitude).lon(geo.longitude) } }
                        .order(SortOrder.Asc)
                }
            }
            addTiebreakers(builder)
        } else if (embedding == null || query.keyword == null) {
            // 벡터 단독은 융합 파이프라인을 쓰지 않으므로 정렬을 걸 수 있다 — 동점 순서를 잃지 않는다.
            builder.sort { s -> s.score { it.order(SortOrder.Desc) } }
            addTiebreakers(builder)
        }
        // 하이브리드는 **정렬을 전혀 걸지 않는다.** OpenSearch 가 거부한다:
        //   "_score sort criteria cannot be applied with any other criteria."
        // 즉 점수 정렬과 tiebreaker 를 함께 줄 수 없다. 기본 정렬이 점수 내림차순이라 빼도 순서는 같고,
        // 대신 **동점 시 순서 보장이 사라진다** — RRF 점수는 1/(60+rank) 의 합이라 동점이 실제로 생긴다.
        // 로컬 프로브가 잡았다(플랜 §8.5 케이스 3). 단위 검사는 요청 모양만 보므로 이걸 못 잡는다.

        return builder.build()
    }

    /**
     * 결정적 tiebreaker (ADR-0050 Phase 1) — 동점시 페이지네이션 flicker 방지.
     * keyword `id` 는 문자열 PK 라 사전순("1","10","100")이 된다 — 숫자 필드 `idSort` 로
     * 정렬한다. `unmappedType`: 재색인 전 옛 인덱스에는 필드가 없어 정렬이 깨지는 것을
     * 막고, 그동안은 keyword `id` 가 최종 순서를 결정적으로 유지한다.
     *
     * **하이브리드 질의에는 걸 수 없다** — 위 `buildRequest` 의 주석 참고.
     */
    private fun addTiebreakers(builder: SearchRequest.Builder) {
        builder.sort { s ->
            s.field { f -> f.field("idSort").order(SortOrder.Asc).unmappedType(FieldType.Long) }
        }
            .sort { s -> s.field { f -> f.field("id").order(SortOrder.Asc) } }
    }

    /**
     * 두 레그를 얹는다 (ADR-0090 D4) — 키워드 레그는 **지금 것 그대로**, 벡터 레그는 같은 필터를 진 k-NN.
     *
     * 벡터 레그에 `embeddingModel` 필터를 거는 것이 **스탬프 전환 창의 안전장치**다. 재색인이 아직
     * 옛 스탬프 문서를 갖고 있으면 그 문서는 다른 벡터 공간이라 거리가 뜻을 잃는다 — 필터가
     * 그것들을 벡터 레그에서 빼고, 그 문서는 키워드 레그로만 올라온다.
     *
     * 필터를 두 레그에 **각각** 거는 이유: 하이브리드는 레그별로 후보를 뽑아 합치므로,
     * 한쪽에만 걸면 다른 쪽이 필터 밖 문서를 끌어 온다(지역 필터를 건 검색에 엉뚱한 지역이 섞인다).
     */
    /**
     * 필터드 HNSW 한 레그. **필터를 `knn` 안에** 두는 것이 중요하다 — 밖에 두면 전역 이웃 k 개를
     * 뽑은 뒤 거르므로, 지역·분류 필터가 좁을수록 살아남는 것이 급격히 줄어 레그가 사실상 꺼진다.
     */
    private fun vectorLeg(embedding: List<Float>, filters: Query): Query = Query.of { q ->
        q.knn(
            KnnQuery.Builder()
                .field(VECTOR_FIELD)
                .vector(embedding)
                .k(hybrid.k)
                // 1-bit 양자화 색인의 근사 거리로 뽑은 후보를 원본 벡터로 재채점한다(없으면 근사 점수가 순위)
                .rescore { r -> r.context { c -> c.oversampleFactor(hybrid.oversample) } }
                .filter(
                    Query.of { f ->
                        f.bool { b ->
                            b.filter(filters)
                            b.filter { m -> m.term { it.field("embeddingModel").value(FieldValue.of(queryVector.modelRef)) } }
                        }
                    },
                )
                .build(),
        )
    }

    private fun hybridQuery(keywordLeg: Query, embedding: List<Float>, filters: Query, depth: Int): Query {
        val vectorLeg = vectorLeg(embedding, filters)
        return Query.of { q ->
            q.hybrid(
                HybridQuery.Builder()
                    .queries(keywordLeg, vectorLeg)
                    // 각 레그가 융합에 내놓는 결과 수. 기본값이 10 이라 그냥 두면 **2페이지부터 빈다** —
                    // 융합은 레그별 상위 N 만 보므로 이 값이 `from + size` 보다 작으면 뒷장이 잘린다.
                    .paginationDepth(maxOf(depth, hybrid.k))
                    .build(),
            )
        }
    }

    /**
     * 분류 가중치 × 완결성 신호 (ADR-0065 P2 + 브라우즈 정렬).
     *
     * 관광 분류를 올리고 상점·식당을 내리는 것에 더해, **키워드 없는 목록의 순서**를 여기서
     * 정한다 — matchAll 은 전 문서 동점이라 이 함수 곱이 곧 순서다. 분류(관광 우선) 안에서
     * 완결성(이미지·개요·전화, AttractionPopularity)이 높은 문서가 먼저 온다. ko/en 에 같은
     * 공식이 걸려 영문 목록도 보여줄 준비가 된 레코드부터 나온다 (이전에는 keyword id
     * 사전순 — 사실상 무작위였다).
     *
     * `scoreMode = Multiply`: 분류 함수 둘은 필터가 배타라 문서당 하나만 걸리고, 완결성
     * fvf 는 항상 걸린다 — 곱해서 (분류 가중치 × ln1p(완결성)) 가 된다. 이전의 First 는
     * 함수가 분류 둘뿐일 때의 선택이고, fvf 를 넣는 순간 First 는 뒤 함수를 무시한다.
     *
     * fvf 의 `ln1p`: 완결성 원값(1.0~3.7)을 그대로 곱하면 키워드 검색에서 BM25 차이를
     * 완결성이 뒤집는다. ln1p 로 눌러 극단 간 배율을 약 2.2배(ln2≈0.69 ~ ln4.7≈1.55)로
     * 묶는다 — 브라우즈(동점)에선 순서를 정하기에 충분하고, 키워드 모드에선 텍스트
     * 적합도가 지배적으로 남는다. `missing = 1.0` 은 재색인 전 옛 인덱스(필드 없음)에서도
     * 중립(상수 배)으로 동작하게 한다.
     *
     * [withClickBoost] 면 클릭 계수(`clickBoost`, 1.0~1.3)를 한 번 더 곱한다. 스위치
     * ([AttractionClickBoostProperties]) 가 꺼져 있으면 함수 자체를 넣지 않아 요청이 이전과 같다.
     */
    private fun withCategoryWeights(matched: Query, commerceIntent: Boolean, withClickBoost: Boolean = false): Query {
        // 질의가 상업 시설을 직접 찾으면 하향을 걸지 않는다 — 「야시장」의 정답은 전부 shopping 이다
        if (!ranking.enabled || commerceIntent) return matched
        return Query.of { q ->
            q.functionScore { fs ->
                fs.query(matched)
                categoryFunction(fs, ranking.sightCategories, ranking.sightWeight)
                categoryFunction(fs, ranking.commerceCategories, ranking.commerceWeight)
                fs.functions { fn ->
                    fn.fieldValueFactor { fvf ->
                        fvf.field("popularityScore")
                            .factor(1.0f)
                            .modifier(FieldValueFactorModifier.Ln1p)
                            .missing(1.0)
                    }
                }
                // 클릭 계수 — 재색인이 상한·최소 표본을 적용해 둔 값이라 그대로 곱한다. 없는 옛 문서는 중립(1.0).
                if (withClickBoost) {
                    fs.functions { fn ->
                        fn.fieldValueFactor { fvf -> fvf.field(CLICK_BOOST).factor(1.0f).missing(1.0) }
                    }
                }
                fs.scoreMode(FunctionScoreMode.Multiply)
                fs.boostMode(FunctionBoostMode.Multiply)
            }
        }
    }

    private fun categoryFunction(
        fs: org.opensearch.client.opensearch._types.query_dsl.FunctionScoreQuery.Builder,
        categories: List<String>,
        weight: Double,
    ) {
        if (categories.isEmpty()) return
        fs.functions { fn ->
            fn.filter { f ->
                f.terms { t ->
                    t.field("category").terms { tv ->
                        tv.value(categories.map { FieldValue.of(it) })
                    }
                }
            }.weight(weight.toFloat())
        }
    }

    private fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * EARTH_RADIUS_KM * asin(sqrt(a))
    }
}
