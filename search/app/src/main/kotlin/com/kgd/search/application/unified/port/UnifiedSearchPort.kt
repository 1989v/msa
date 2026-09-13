package com.kgd.search.application.unified.port

/** `unified` 인덱스 (관광지를 뺀 타입들) 검색. */
interface UnifiedSearchPort {
    fun search(query: Query): Page

    data class Query(
        /** null 이면 키워드 없이 인기순 — 타입 의도어만으로 된 질의(「게임」)가 이 경우다 */
        val keyword: String?,
        val type: String,
        /** `facets.*` 필터 — 지금은 비어 있고, 타입별 사전이 붙으면 채워진다 */
        val facets: Map<String, String> = emptyMap(),
        val size: Int,
    )

    data class Hit(
        val id: String,
        val type: String,
        val sourceId: String,
        val slug: String,
        val title: String,
        val summary: String?,
        val category: String?,
        val thumbnailUrl: String?,
        /** 타입별 축 — 개념의 level, 게임의 genre 처럼 화면이 그대로 보여줄 값 */
        val facets: Map<String, String> = emptyMap(),
        val score: Double,
    )

    data class Page(val hits: List<Hit>, val total: Long)
}
