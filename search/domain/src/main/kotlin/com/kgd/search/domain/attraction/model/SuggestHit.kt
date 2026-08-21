package com.kgd.search.domain.attraction.model

/**
 * 통합 자동완성 항목 (ADR-0065) — 지역(행정 계층)과 관광지를 한 응답으로 섞는다.
 * 지역 선택은 FE 에서 지도 이동 + 반경 검색으로 이어지므로 좌표를 동봉한다.
 */
data class SuggestHit(
    val type: Type,
    val id: String,
    val title: String,
    /** 관광지일 때만 — 표시명에서 분리된 다른 표기 (영문 문서: 국문명) */
    val titleLocal: String? = null,
    val latitude: Double?,
    val longitude: Double?,
    /** 지역일 때만 — CONTINENT/COUNTRY/REGION/CITY */
    val regionLevel: String? = null,
    /** 관광지일 때만 — 카테고리 슬러그 */
    val category: String? = null,
) {
    enum class Type { REGION, ATTRACTION }
}
