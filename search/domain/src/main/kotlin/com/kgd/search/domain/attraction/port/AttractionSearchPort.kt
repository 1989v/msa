package com.kgd.search.domain.attraction.port

import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttributeFacetCounts
import com.kgd.search.domain.attraction.model.AttributeSelection
import com.kgd.search.domain.attraction.model.SuggestHit
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface AttractionSearchPort {

    fun search(query: SearchQuery, pageable: Pageable): SearchResult

    fun findById(id: String): AttractionDocument?

    /**
     * 통합 자동완성 — 지역(인구 부스트, 상위 고정) + 관광지 prefix 매칭.
     * [lang] 은 관광지 문서 필터이자 지역 표기 언어 선택(ko→nameKo 우선).
     */
    fun suggest(prefix: String, lang: String?, size: Int): List<SuggestHit>

    /**
     * 오타 교정 — 어느 검색 필드에도 없는 단어만 관광지 제목에서 가까운 표기로 바꾼다.
     * 고칠 단어가 없으면 null. 제대로 친 질의는 건드리지 않는 것이 이 함수의 첫째 조건이다.
     */
    fun correct(keyword: String, lang: String?): String?

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
    ) {
        init {
            // 건수는 오늘 요일(「오늘 정기휴무 아님」)이 있어야 셀 수 있다. 요일은 선택이 갖는다.
            require(!countAttributeFacets || attributes != null) { "속성 패싯을 세려면 선택(빈 선택 포함)이 필요하다" }
        }
    }

    /** [attributeFacets] 는 건수 요청을 내지 않았거나 그 요청이 실패하면 null — 결과는 그래도 돌려준다. */
    data class SearchResult(
        val page: Page<AttractionHit>,
        val attributeFacets: AttributeFacetCounts? = null,
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
