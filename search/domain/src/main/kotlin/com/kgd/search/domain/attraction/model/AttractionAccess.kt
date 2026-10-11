package com.kgd.search.domain.attraction.model

import java.time.LocalDate

/**
 * 「가까운 역·정류장」 — place 가 주 1회 미리 계산한 관광지별 도시철도역(직선 2,000m 안 2곳)·버스정류장(500m 안 2곳).
 *
 * [stops] 는 종류(RAIL → BUS)·순위 순, [busCovered] 는 관광지 시군구가 버스 원천의 연계 지역인가다.
 * `false` 면 정류장이 없는 게 아니라 원천이 그 지역을 담지 않는다 — 화면은 「이 지역은 버스정류장 위치 자료가 없습니다」를 낸다.
 * `null` 은 판정 전(시군구 모름·옛 회차)이다. 거리는 하버사인 직선거리라 걷는 길이·시간이 아니다.
 */
data class AttractionAccess(val stops: List<Stop>, val busCovered: Boolean?) {

    /** 보일 것이 있나 — 줄이 있거나 미연계 안내를 내야 할 때. 아니면 색인에 싣지 않는다. */
    val hasContent: Boolean get() = stops.isNotEmpty() || busCovered == false

    /** [nameEn]·[lines] 는 역만 갖는다. [baseDate] 는 원천 기준일(역)·수집일(정류장). */
    data class Stop(
        val kind: TransitKind,
        val rank: Int,
        val name: String,
        val nameEn: String?,
        val lines: String?,
        val distanceM: Int,
        val baseDate: LocalDate?,
    )
}

enum class TransitKind { RAIL, BUS }
