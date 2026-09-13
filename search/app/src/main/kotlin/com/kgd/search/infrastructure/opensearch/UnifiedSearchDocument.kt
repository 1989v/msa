package com.kgd.search.infrastructure.opensearch

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * `unified` 인덱스 문서 (ADR-0090 D6). 필드 정의는 batch 의 `opensearch/unified-index.json` 이 SSOT.
 * `body` 는 검색 대상일 뿐 응답에 싣지 않으므로 읽지 않는다(질의가 `_source.excludes` 로 뺀다).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class UnifiedSearchDocument(
    val id: String,
    val type: String,
    val sourceId: String,
    val slug: String,
    val lang: String,
    val title: String,
    val titleEn: String? = null,
    val summary: String? = null,
    val category: String? = null,
    val tags: List<String> = emptyList(),
    val facets: Map<String, String> = emptyMap(),
    val popularity: Float = 0f,
    val publishedAt: String? = null,
    val thumbnailUrl: String? = null,
)
