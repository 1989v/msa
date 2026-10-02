package com.kgd.place.application.attraction.usecase

/**
 * 재색인(search-batch)이 쓰는 경로 — 페이지마다 id 묶음의 부가 정보(무장애 · 웰니스 · 집중률)를 **한 번에** 받는다.
 * 표마다 따로 부르면 페이지당 왕복이 표 수만큼 는다. 아무것도 없는 id 는 응답에 없다.
 */
interface LookupAttractionExtrasUseCase {
    fun lookup(attractionIds: List<Long>): List<Found>

    data class Found(
        val attractionId: Long,
        val barrierFree: BarrierFree?,
        val wellness: Wellness?,
        val congestion: Congestion? = null,
    )

    /** [detailRaw] 는 상세 응답 원문 그대로 — 받는 쪽이 줄을 고른다. 상세를 아직 안 받았으면 null. */
    data class BarrierFree(val flags: List<String>, val detailRaw: String?)

    data class Wellness(val themaCd: String)

    /**
     * 집중률 앞 30일 — 화면에 쓰는 매칭(정확 · 정규화)으로 이은 곳만. [days] 는 예측일 순이고 지난 날도 들어 있다 —
     * 오늘을 거르는 것은 화면이다(색인은 하루 한 번 바뀌어 자정을 넘기면 어제가 남는다).
     */
    data class Congestion(val matchMethod: String, val days: List<Day>)

    /** [date] 는 `yyyy-MM-dd`, [rate] 는 원천 집중률 그대로. */
    data class Day(val date: String, val rate: Double)
}
