package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.SimilarAttractions
import java.time.LocalDateTime

interface AttractionSimilarRepositoryPort {
    /** 문서·스탬프마다 기존 행을 지우고 [lists] 로 채운다. 반환은 새로 쓴 행 수. */
    fun replace(lists: List<SimilarAttractions>, computedAt: LocalDateTime): Int

    /** 행이 있는 문서만, 순위 순으로. */
    fun findByModelAndIds(modelRef: String, attractionIds: List<Long>): List<SimilarAttractions>

    /** 존재하는 관광지 id 만 남긴다 — 없는 id 를 가리키는 목록은 상세에서 깨진 링크가 된다. */
    fun existingAttractionIds(attractionIds: Collection<Long>): Set<Long>
}
