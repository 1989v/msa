package com.kgd.search.domain.attraction.port

import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.SuggestHit
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface AttractionSearchPort {

    fun search(query: SearchQuery, pageable: Pageable): Page<AttractionHit>

    fun findById(id: String): AttractionDocument?

    /**
     * 통합 자동완성 — 지역(인구 부스트, 상위 고정) + 관광지 prefix 매칭.
     * [lang] 은 관광지 문서 필터이자 지역 표기 언어 선택(ko→nameKo 우선).
     */
    fun suggest(prefix: String, lang: String?, size: Int): List<SuggestHit>

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
        val geo: GeoFilter? = null,
        /**
         * 질의 벡터 (ADR-0090). **null 이면 BM25 만** — 사전 미적중·기능 꺼짐·거리순 정렬이 그 경우다.
         * 벡터를 만드는 것은 여기가 아니라 사전이다(서버에는 모델이 없다). 어댑터는 받은 벡터로
         * 레그를 하나 더 얹을 뿐이라, 이 필드가 곧 「벡터 레그 on/off」다.
         */
        val embedding: List<Float>? = null,
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
