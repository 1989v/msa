package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.GocampingSite

interface GocampingSiteRepositoryPort {
    /** 받은 곳만 덮는다 — 원천에서 빠진 곳은 지우지 않는다. 반환은 반영한 행 수. */
    fun upsertAll(sites: List<GocampingSite>): Int

    /**
     * 관광지 id → 「캠핑장 정보」(원문 중 [GocampingSite.DISPLAY_KEYS] 만, 값이 빈 키는 뺀 JSON 객체 문자열).
     * 고캠핑으로 만든 행(attraction_id)과 같은 곳으로 이어진 우리 캠핑장(matched_attraction_id) 모두.
     */
    fun findCampingInfo(attractionIds: Collection<Long>): Map<Long, String>
}
