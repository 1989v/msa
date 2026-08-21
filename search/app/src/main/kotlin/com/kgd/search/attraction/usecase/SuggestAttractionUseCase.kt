package com.kgd.search.application.attraction.usecase

interface SuggestAttractionUseCase {
    fun execute(prefix: String, lang: String?, size: Int): List<Suggestion>

    /** type=REGION 이면 regionLevel, ATTRACTION 이면 category 가 채워진다. */
    data class Suggestion(
        val type: String,
        val id: String,
        val title: String,
        /** 관광지일 때만 — 표시명에서 분리된 다른 표기 (영문 문서: 국문명) */
        val titleLocal: String? = null,
        val latitude: Double?,
        val longitude: Double?,
        val regionLevel: String? = null,
        val category: String? = null,
    )
}
