package com.kgd.search.application.unified.usecase

/**
 * 통합 검색 (ADR-0090 D6) — 한 검색어로 관광지·글·게임·개념·혜택·서비스·상품을 **타입별로 묶어** 낸다.
 *
 * 관광지는 `attractions` 인덱스(하이브리드·쿼리 언더스탠딩 그대로), 나머지는 `unified` 인덱스에서 온다.
 * 타입 간 점수는 비교하지 않는다 — 묶음 안에서만 순위가 있고, 묶음의 순서는 타입 의도·건수로 정한다.
 */
interface SearchUnifiedUseCase {
    fun execute(query: Query): Result

    data class Query(
        val q: String,
        /** 지정하면 그 타입만. 없으면 쿼리 언더스탠딩의 타입 의도, 그것도 없으면 전 타입 */
        val type: String? = null,
        /** 관광지에만 적용된다 — 나머지 타입은 국문 문서 하나에 영문 필드를 같이 실었다 */
        val lang: String? = null,
        /** 타입별 상위 몇 건 */
        val size: Int = 5,
    )

    data class Hit(
        val type: String,
        val id: String,
        /** FE 가 `type` 과 함께 주소를 조립하는 열쇠 — 관광지·상품은 id, 글·게임·혜택·개념·서비스는 slug */
        val slug: String,
        val title: String,
        val summary: String? = null,
        val category: String? = null,
        val thumbnailUrl: String? = null,
        /** 타입별 축(개념 level · 게임 genre …). 관광지는 비어 있다 */
        val facets: Map<String, String> = emptyMap(),
        val score: Double = 0.0,
    )

    data class Group(
        val type: String,
        val total: Long,
        val hits: List<Hit>,
    )

    /** 쿼리 언더스탠딩이 읽은 것 — 화면이 「블로그 글에서 ‘하이브리드’」처럼 되받을 수 있게 */
    data class Understood(
        val type: String?,
        val residual: String?,
    )

    data class Result(
        val query: String,
        val understood: Understood,
        val groups: List<Group>,
    )
}
