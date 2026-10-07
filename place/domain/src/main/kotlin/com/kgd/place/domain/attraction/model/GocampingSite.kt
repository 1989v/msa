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

    companion object {
        /**
         * 상세 「캠핑장 정보」에 내는 원문 키 — 업종 · 사이트 수 · 부대시설 · 애견 동반 · 운영 기간·요일 · 운영 상태.
         * 예약 URL(`resveUrl`)·홈페이지는 내지 않는다(ADR-0104 결정 6). 원문 값 그대로 — 고르는 것만 한다.
         */
        val DISPLAY_KEYS = listOf(
            "induty", "gnrlSiteCo", "autoSiteCo", "glampSiteCo", "caravSiteCo", "indvdlCaravSiteCo",
            "sbrsCl", "animalCmgCl", "operPdCl", "operDeCl", "manageSttus",
        )
    }
}
