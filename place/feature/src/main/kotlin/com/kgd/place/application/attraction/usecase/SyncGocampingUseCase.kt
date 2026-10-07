package com.kgd.place.application.attraction.usecase

import java.time.LocalDateTime

/** 고캠핑 원천 표 적재 — 수집기(place-ingest)만 부른다 (ADR-0104 Q-P2-KEY). */
interface SyncGocampingUseCase {
    fun upsert(items: List<Item>): Applied

    data class Item(
        val contentId: String,
        val facilityName: String,
        val manageStatus: String?,
        val latitude: Double?,
        val longitude: Double?,
        val itemRaw: String,
        val matchedAttractionId: Long?,
        val matchMethod: String?,
        val syncedAt: LocalDateTime,
    )

    /** [linked] 는 이 원천으로 만든 관광지 행(source=GOCAMPING)에 이어진 곳 수 */
    data class Applied(val applied: Int, val linked: Int)
}
