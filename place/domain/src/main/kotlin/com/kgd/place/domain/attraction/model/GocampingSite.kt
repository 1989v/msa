package com.kgd.place.domain.attraction.model

import java.time.LocalDateTime

/**
 * 고캠핑 캠핑장 한 곳 (data.go.kr 15101933 `basedList`, ADR-0104 Q-P2-KEY). [itemRaw] 는 원천 행 원문(82키)이고,
 * 우리 TourAPI 캠핑장과 같은 곳이면 [matchedAttractionId], 이 원천으로 만든 관광지 행이면 [attractionId] 가 파생 값이다.
 */
data class GocampingSite(
    val contentId: String,
    val facilityName: String,
    val manageStatus: String?,
    val latitude: Double?,
    val longitude: Double?,
    val itemRaw: String,
    val matchedAttractionId: Long?,
    val matchMethod: String?,
    val attractionId: Long?,
    val syncedAt: LocalDateTime,
) {
    init {
        require(contentId.isNotBlank()) { "고캠핑 contentId 는 비어있을 수 없습니다" }
        require(facilityName.isNotBlank()) { "캠핑장 이름은 비어있을 수 없습니다: $contentId" }
        require(itemRaw.isNotBlank()) { "원문은 비어있을 수 없습니다: $contentId" }
    }
}
