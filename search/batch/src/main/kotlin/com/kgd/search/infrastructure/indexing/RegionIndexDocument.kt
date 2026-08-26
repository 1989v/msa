package com.kgd.search.infrastructure.indexing

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude

/**
 * `regions` 인덱스 색인 문서 (ADR-0065 통합 자동완성).
 * 필드 정의는 `opensearch/regions-index.json` 이 SSOT.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RegionIndexDocument(
    val id: String,
    val name: String,
    val nameKo: String? = null,
    val level: String,
    val countryCode: String? = null,
    val location: GeoPoint? = null,
    val population: Long = 0,
)
