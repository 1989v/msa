package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionCongestion
import com.kgd.place.domain.attraction.model.CongestionForecast
import com.kgd.place.domain.attraction.model.NameMatch
import java.time.LocalDateTime

/** 관광지 집중률 표. 관광지 행(attractions)은 읽지도 쓰지도 않는다 — 매칭은 수집기가 끝내고 온다. */
interface AttractionCongestionRepositoryPort {

    /** 그 시군구의 행을 [rows] 로 통째로 바꾼다. 반환은 지운 이전 행 수. 다른 시군구는 건드리지 않는다. */
    fun replaceSigungu(signguCd: String, rows: List<AttractionCongestion>, fetchedAt: LocalDateTime): Int

    /** [attractionIds] 에 [methods] 로 이어진 예측. 원문을 못 읽은 날은 빠진다. 한 관광지에 여러 행이 올 수 있다. */
    fun findForecasts(attractionIds: Collection<Long>, methods: Set<NameMatch>): List<CongestionForecast>
}
