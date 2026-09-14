package com.kgd.analytics.application.popularity.port

import java.time.LocalDate

/** 관광지 인기 집계 적재 (ADR-0095). 구현은 infrastructure 가 갖는다. */
interface AttractionPopularityPort {
    /** @return 적재한 행 수 */
    fun aggregateInto(day: LocalDate): Int
}
