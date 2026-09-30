package com.kgd.place.application.attraction.usecase

/** 재색인(search-batch)이 쓰는 경로 — 페이지마다 id 묶음의 비슷한 곳 목록을 받아 상세 문서에 싣는다. */
interface LookupAttractionSimilarUseCase {
    fun lookup(modelRef: String, attractionIds: List<Long>): List<Found>

    /** [modelRef] 는 행에 저장된 스탬프다 — 받는 쪽이 설정과 한 번 더 견준다. */
    data class Found(val attractionId: Long, val modelRef: String, val similar: List<Similar>)

    data class Similar(val id: Long, val score: Double)
}
