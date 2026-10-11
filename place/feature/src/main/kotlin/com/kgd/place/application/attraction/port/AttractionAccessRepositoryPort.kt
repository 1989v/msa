package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionAccess
import java.time.LocalDateTime

/** 관광지 가는 법 표(`attraction_access`). 원천 표와 조인하지 않는다 — 이름·노선은 사본이다. */
interface AttractionAccessRepositoryPort {

    /** [attractionIds] 의 행을 지우고 [rows] 를 [computedAt] 회차로 넣는다. 반환은 지운 이전 행 수. */
    fun replace(attractionIds: Collection<Long>, rows: List<AttractionAccess>, computedAt: LocalDateTime): Int

    fun deleteComputedBefore(computedAt: LocalDateTime): Int

    /** 종류·순위 순. */
    fun findByAttractionIds(attractionIds: Collection<Long>): List<AttractionAccess>

    /**
     * 관광지 시군구가 버스 원천 연계 지역인가 — 연계 판정을 아직 받지 않았거나 시군구를 모르면 그 id 는 없다.
     * 버스 원천은 BIS 연계 지자체만 담아서, 미연계 시군구의 「정류장 없음」은 「자료 없음」으로 내야 한다.
     */
    fun findBusCoverage(attractionIds: Collection<Long>): Map<Long, Boolean>
}
