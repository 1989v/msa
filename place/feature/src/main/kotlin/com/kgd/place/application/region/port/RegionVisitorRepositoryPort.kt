package com.kgd.place.application.region.port

import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorDaily
import com.kgd.place.domain.region.model.RegionVisitorTrend
import java.time.LocalDate
import java.time.LocalDateTime

/** 지역 방문자 일자 표(`region_visitor_daily`). */
interface RegionVisitorRepositoryPort {

    /** (수준, 지역, 날짜, 구분) 키 upsert. 반환은 보낸 행 수. */
    fun upsertAll(rows: List<RegionVisitorDaily>, syncedAt: LocalDateTime): Int

    fun findLatestDate(level: AdministrativeRegionLevel, code: String): LocalDate?

    fun findMonthlyTotals(level: AdministrativeRegionLevel, code: String, from: LocalDate): List<RegionVisitorTrend.MonthlyTotal>
}
