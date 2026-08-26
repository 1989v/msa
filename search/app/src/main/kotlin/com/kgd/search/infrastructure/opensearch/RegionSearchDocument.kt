package com.kgd.search.infrastructure.opensearch

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * `regions` 인덱스 문서 (ADR-0065 — 통합 자동완성용 행정 계층).
 * 필드 정의는 batch 의 `opensearch/regions-index.json` 이 SSOT.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class RegionSearchDocument(
    val id: String,
    val name: String,
    val nameKo: String? = null,
    val level: String,
    val countryCode: String? = null,
    val location: AttractionSearchDocument.GeoPoint? = null,
    val population: Long = 0,
)
