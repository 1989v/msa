package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionRelated
import com.kgd.place.domain.attraction.model.NameMatch
import java.time.LocalDateTime

/** 연관 관광지 표. 관광지 행(attractions)은 읽지도 쓰지도 않는다 — 매칭은 수집기가 끝내고 온다. */
interface AttractionRelatedRepositoryPort {

    /** 그 시군구의 행을 [rows] 로 통째로 바꾼다. 반환은 지운 이전 행 수. 다른 시군구는 건드리지 않는다. */
    fun replaceSigungu(signguCd: String, rows: List<AttractionRelated>, fetchedAt: LocalDateTime): Int

    /** 시군구별 가진 최신 기준 월(`yyyyMM`). 받은 적 없는 시군구는 없다. */
    fun latestBaseYmBySigungu(): Map<String, String>

    /** [attractionIds] 에 출발이 [methods] 로 이어진 행. 대상 파생 값을 못 읽은 행은 빠진다. 한 관광지에 여러 행이 올 수 있다. */
    fun findLinked(attractionIds: Collection<Long>, methods: Set<NameMatch>): List<AttractionRelated>
}
