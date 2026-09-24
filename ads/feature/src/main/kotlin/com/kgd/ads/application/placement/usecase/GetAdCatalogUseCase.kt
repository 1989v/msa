package com.kgd.ads.application.placement.usecase

import com.kgd.ads.domain.placement.model.PlacementFormat

/** 광고주 카탈로그 — 유료를 받는 활성 지면과 문맥 카테고리. 캠페인 편집 화면이 여기서 고른다. */
interface GetAdCatalogUseCase {
    fun execute(): Catalog

    data class Catalog(val placements: List<CatalogPlacement>, val categories: List<CatalogCategory>)

    /** @param averageDailyRequests 최근 7일(오늘 제외) 일평균 요청 수 */
    data class CatalogPlacement(
        val key: String,
        val host: String,
        val format: PlacementFormat,
        val aspectRatios: List<String>,
        val floorMicros: Long,
        val description: String,
        val averageDailyRequests: Long,
    )

    data class CatalogCategory(val code: String, val label: String)
}
