package com.kgd.place.application.attraction.usecase

/**
 * 재색인(search-batch)이 쓰는 경로 — 페이지마다 id 묶음의 부가 정보(무장애 · 웰니스)를 **한 번에** 받는다.
 * 표마다 따로 부르면 페이지당 왕복이 표 수만큼 는다. 아무것도 없는 id 는 응답에 없다.
 */
interface LookupAttractionExtrasUseCase {
    fun lookup(attractionIds: List<Long>): List<Found>

    data class Found(val attractionId: Long, val barrierFree: BarrierFree?, val wellness: Wellness?)

    /** [detailRaw] 는 상세 응답 원문 그대로 — 받는 쪽이 줄을 고른다. 상세를 아직 안 받았으면 null. */
    data class BarrierFree(val flags: List<String>, val detailRaw: String?)

    data class Wellness(val themaCd: String)
}
