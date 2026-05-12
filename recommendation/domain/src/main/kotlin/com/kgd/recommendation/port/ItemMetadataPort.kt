package com.kgd.recommendation.port

/**
 * Cold-start fallback 시 item 의 cityId/categoryId 가 필요. 향후 별도 메타 서비스로 분리 가능.
 *
 * Phase 2 시점에서는 ClickHouse recommendation_score_daily 에서 inferred 또는 mock 매핑.
 * Phase 4+ 에서 product 서비스 와 연동하거나 메타 DB 별도 운영.
 */
interface ItemMetadataPort {
    fun getCityAndCategory(itemId: Long): ItemMetadata?
}

data class ItemMetadata(
    val itemId: Long,
    val cityId: Long,
    val categoryId: Long,
)
