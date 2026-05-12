package com.kgd.recommendation.infrastructure.persistence

/**
 * ClickHouse 집계 결과 한 row (도시×카테고리×아이템 단위).
 */
data class CbScoreRow(
    val cityId: Long,
    val categoryId: Long,
    val itemId: Long,
    val reservationCount: Long,
    val clickCount: Long,
    val addwishCount: Long,
    val pageviewCount: Long,
)
