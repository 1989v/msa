package com.kgd.search.domain.attraction.port

import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionFeedEntry
import com.kgd.search.domain.attraction.model.AttractionSignalSort
import com.kgd.search.domain.attraction.model.AttributeFacetCounts
import com.kgd.search.domain.attraction.model.AttributeSelection
import com.kgd.search.domain.attraction.model.EventDateRange
import com.kgd.search.domain.attraction.model.EventSitemapEntry
import com.kgd.search.domain.attraction.model.SuggestHit
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface AttractionSearchPort {

    fun search(query: SearchQuery, pageable: Pageable): SearchResult

    fun findById(id: String): AttractionDocument?

    /**
     * 통합 자동완성 — 지역(인구 부스트, 상위 고정) + 관광지 prefix 매칭.
     * [lang] 은 관광지 문서 필터이자 지역 표기 언어 선택(ko→nameKo 우선).
     * [eventRange] 는 관광지 쪽에 「행사가 아니거나 범위 안」으로 늘 건다 — 끝난 행사를 제안하지 않는다.
     */
    fun suggest(prefix: String, lang: String?, size: Int, eventRange: EventDateRange): List<SuggestHit>

    /**
     * 오타 교정 — 어느 검색 필드에도 없는 단어만 관광지 제목에서 가까운 표기로 바꾼다.
     * 고칠 단어가 없으면 null. 제대로 친 질의는 건드리지 않는 것이 이 함수의 첫째 조건이다.
     */
    fun correct(keyword: String, lang: String?): String?

    /**
     * 행사 sitemap 후보 — 행사 유형(15·85) ∧ 개요 필드 있음 ∧ 유효 기간이 [range] 안. 날짜 없는 행사는 범위 필드가 없어 오지 않는다.
     * 빈 개요(`""`)는 색인에서 「있음」으로 잡히므로 [EventSitemapEntry.hasOverview] 로 한 번 더 가른다.
     */
    fun findEvents(range: EventDateRange): List<EventSitemapEntry>

    /**
     * 최근 갱신 피드(RSS) — [lang] 문서 중 본문 변경 시각이 있는 것을 그 시각 내림차순, 같으면 숫자 id 오름차순으로 [size] 건.
     * 시각이 없는 문서(place 가 아직 채우지 않은 행)는 오지 않는다.
     */
    fun findRecentlyUpdated(lang: String, size: Int): List<AttractionFeedEntry>

    /**
     * 색인에 문서가 1건 이상인 분류 코드 — 언어(`lang`) → `lclsSystm1~3` 값을 합친 집합.
     * [bucketSize] 는 받을 코드 수의 상한이고, 어느 버킷이든 `sum_other_doc_count > 0` 이면(잘렸으면) 예외를 던진다 —
     * 잘린 집합으로 사전을 거르면 문서가 있는 코드까지 빠진다.
     */
    fun indexedCategoryCodes(bucketSize: Int): Map<String, Set<String>>

    /**
     * 키워드가 null/blank 면 필터-only 탐색 (지도 영역 브라우징).
     * [geo] 지정 시 반경 필터가 걸리고, sortByDistance 면 거리 오름차순 정렬.
     */
    data class SearchQuery(
        val keyword: String? = null,
        val lang: String? = null,
        val areaCode: String? = null,
        /** 법정동 축 (ADR-0071). areaCode 와 같이 주지 않는다 — 어느 쪽이 이기는지 호출자가 모른다. */
        val sidoCode: String? = null,
        val sigunguCode: String? = null,
        /**
         * 분류 필터 (복수). 목록은 관광 분류만 올리고 음식·쇼핑은 지도 오버레이로 가르기
         * 위해 여러 개를 받는다 (ADR-0071 §5). 비어 있으면 필터하지 않는다.
         */
        val categories: List<String> = emptyList(),
        /**
         * 쿼리 언더스탠딩이 만든 원천 분류 필터 — 인덱스 필드 → 값 (`contentTypeId` · `lclsSystm1~3`).
         * 사용자가 고른 [categories] 와 축이 달라 함께 걸릴 수 있다 — 이쪽은 질의에서 유도한 것이고
         * 저쪽은 화면에서 고른 것이다. 어댑터는 필드 이름을 해석하지 않고 그대로 term 필터로 건다.
         */
        val facets: Map<String, String> = emptyMap(),
        /**
         * 질의가 상점·식당·시장을 직접 가리킨다 (질의 이해가 판정). true 면 어댑터는 분류 가중치
         * (관광 3.0 / 상업 0.35)를 걸지 않는다 — 정답이 상업 분류인 질의에서 하향은 정답을 내린다.
         */
        val commerceIntent: Boolean = false,
        val geo: GeoFilter? = null,
        /**
         * 질의 벡터 (ADR-0090). **null 이면 BM25 만** — 사전 미적중·기능 꺼짐·거리순 정렬이 그 경우다.
         * 벡터를 만드는 것은 여기가 아니라 사전이다(서버에는 모델이 없다). 어댑터는 받은 벡터로
         * 레그를 하나 더 얹을 뿐이라, 이 필드가 곧 「벡터 레그 on/off」다.
         */
        val embedding: List<Float>? = null,
        /**
         * 속성 패싯 선택. 고른 속성은 본 질의의 모든 레그에 필터로 들어간다 — [countAttributeFacets] 와 무관하다.
         * 아무것도 고르지 않았으면 null 이 아니라 빈 선택이다(오늘 요일은 건수에도 필요하다).
         */
        val attributes: AttributeSelection? = null,
        /**
         * true 일 때만 속성 패싯 건수 요청을 본 질의와 병렬로 낸다. 같은 API 를 상세의 주변·편의시설과 지도가
         * 부르므로 기본은 세지 않는다 — 목록 첫 쪽만 센다.
         */
        val countAttributeFacets: Boolean = false,
        /**
         * 행사 기간 조건. 「행사가 아니거나 범위 안」으로 걸려 행사가 아닌 문서는 영향을 받지 않는다.
         * null 이면 조건이 없고 요청은 이 필드가 생기기 전과 같다.
         */
        val eventRange: EventDateRange? = null,
        /** 유효 시작일 오름차순(날짜 없음은 뒤), 같으면 id 오름차순. 거리순보다 우선한다. */
        val sortByEventStart: Boolean = false,
        /** 이 사이트 근거 정렬 — 하한 이상 문서만 값 내림차순, 같으면 id 오름차순. null 이면 이 조건이 없다. */
        val signalSort: AttractionSignalSort? = null,
        /**
         * 어휘 근거를 요구할 말. null 이 아니면 본 질의 전에 이 말이 같은 필터 안에서
         * `minimum_should_match` [EVIDENCE_MINIMUM_SHOULD_MATCH] 로 맞는 문서가 있는지 먼저 센다 — 없으면 본 질의와
         * 건수 요청을 내지 않고 0건이다([SearchResult.noEvidence]). null 이면 요청은 이 필드가 생기기 전과 같다.
         */
        val evidenceKeyword: String? = null,
        /**
         * 결과 집합을 어휘 근거로 한정한다 — 검색어 일치에 `minimum_should_match` 를 건다. 그 일치가 키워드 레그와
         * 벡터 레그(knn filter)에 같이 들어가므로 두 레그가 함께 좁아지고, 건수 요청도 같은 일치로 센다.
         */
        val confine: Boolean = false,
    ) {
        init {
            // 정렬이 점수를 버리므로 벡터 레그는 값만 치르고, 하이브리드 질의는 정렬을 아예 받지 않는다.
            require(!sortByEventStart || embedding == null) { "시작일 정렬에는 벡터를 실지 않는다" }
            require(signalSort == null || embedding == null) { "찜·클릭 정렬에는 벡터를 실지 않는다" }
            require(signalSort == null || !sortByEventStart) { "정렬은 하나만 건다" }
            // 건수는 오늘 요일(「오늘 정기휴무 아님」)이 있어야 셀 수 있다. 요일은 선택이 갖는다.
            require(!countAttributeFacets || attributes != null) { "속성 패싯을 세려면 선택(빈 선택 포함)이 필요하다" }
            // 한정은 본 질의가 곧 근거 집합이라 근거 요청을 따로 내지 않는다
            require(!confine || evidenceKeyword == null) { "한정과 근거 요청은 함께 걸지 않는다" }
        }
    }

    companion object {
        /** 토큰 2개 이하는 전부, 3개 이상은 75% — 「에펠탑」이 `탑` 하나로 충렬탑에 맞지 않게 한다. */
        const val EVIDENCE_MINIMUM_SHOULD_MATCH = "2<75%"
    }

    /** [attributeFacets] 는 건수 요청을 내지 않았거나 그 요청이 실패하면 null — 결과는 그래도 돌려준다. */
    data class SearchResult(
        val page: Page<AttractionHit>,
        val attributeFacets: AttributeFacetCounts? = null,
        /** 근거 요청이 0건이라 본 질의를 내지 않았다. */
        val noEvidence: Boolean = false,
    )

    data class GeoFilter(
        val latitude: Double,
        val longitude: Double,
        val radiusKm: Double,
        val sortByDistance: Boolean = false,
    )

    /** [distanceKm] 는 geo 검색일 때만 채워진다. */
    data class AttractionHit(
        val document: AttractionDocument,
        val score: Double,
        val distanceKm: Double? = null,
    )
}
