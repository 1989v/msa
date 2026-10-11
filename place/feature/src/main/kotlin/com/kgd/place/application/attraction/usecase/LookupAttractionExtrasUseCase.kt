package com.kgd.place.application.attraction.usecase

/**
 * 재색인(search-batch)이 쓰는 경로 — 페이지마다 id 묶음의 부가 정보(무장애 · 웰니스 · 집중률 · 연관 관광지 · 가는 법)를 **한 번에** 받는다.
 * 표마다 따로 부르면 페이지당 왕복이 표 수만큼 는다. 아무것도 없는 id 는 응답에 없다.
 */
interface LookupAttractionExtrasUseCase {
    fun lookup(attractionIds: List<Long>): List<Found>

    data class Found(
        val attractionId: Long,
        val barrierFree: BarrierFree?,
        val wellness: Wellness?,
        val congestion: Congestion? = null,
        val relatedPlaces: List<RelatedPlace>? = null,
        /** 「캠핑장 정보」 — 고캠핑 원문 중 화면에 내는 키만 담은 JSON 객체 문자열(GocampingSite.DISPLAY_KEYS). 캠핑장이 아니면 null */
        val camping: String? = null,
        /** 「가까운 역·정류장」 — 줄이 있거나 버스 원천 미연계 시군구일 때만. 없으면 null */
        val access: Access? = null,
    )

    /**
     * 가는 법 — [stops] 는 종류(RAIL→BUS)·순위 순, [busCovered] 는 관광지 시군구가 버스 원천 연계 지역인가(판정 전·시군구 모름이면 null).
     * `false` 면 버스 칸은 「자료 없음」이다 — 정류장이 없는 게 아니라 원천이 그 지역을 담지 않는다.
     */
    data class Access(val stops: List<AccessStop>, val busCovered: Boolean?)

    /** [distanceM] 은 하버사인 직선거리(m), [baseDate] 는 원천 기준일 `yyyy-MM-dd`. 버스는 [nameEn]·[lines] 가 없다. */
    data class AccessStop(
        val kind: String,
        val rank: Int,
        val name: String,
        val nameEn: String?,
        val lines: String?,
        val distanceM: Int,
        val baseDate: String?,
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

    /**
     * 「여기 온 사람들이 함께 간 곳」 한 건 — 화면에 쓰는 매칭(정확 · 정규화)으로 우리 관광지 행에 이은 대상만(원천 분류 무관), 원천 순위 순.
     * [category] 는 원천 소분류 이름(`rlteCtgrySclsNm`) 그대로. 이름은 싣지 않는다 — 재색인이 그 관광지의 지금 제목을 쓴다.
     */
    data class RelatedPlace(val rank: Int, val attractionId: Long, val category: String?)
}
