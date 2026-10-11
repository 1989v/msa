package com.kgd.place.application.region.port

import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorDaily
import com.kgd.place.domain.region.model.RegionVisitorRanking
import com.kgd.place.domain.region.model.RegionVisitorTrend
import java.time.LocalDate
import java.time.LocalDateTime

/** 지역 방문자 일자 표(`region_visitor_daily`). */
interface RegionVisitorRepositoryPort {

    /** (수준, 지역, 날짜, 구분) 키 upsert. 반환은 보낸 행 수. */
    fun upsertAll(rows: List<RegionVisitorDaily>, syncedAt: LocalDateTime): Int

    fun findLatestDate(level: AdministrativeRegionLevel, code: String): LocalDate?

    fun findMonthlyTotals(level: AdministrativeRegionLevel, code: String, from: LocalDate): List<RegionVisitorTrend.MonthlyTotal>

    /** 시도 [sidoCode] 아래 시군구 행 중 가장 최근 날. 없으면 null. */
    fun findLatestSigunguDate(sidoCode: String): LocalDate?

    /** 시도 [sidoCode] 아래 시군구의 (시군구, 달, 구분) 합계와 행 수 — [from] 이후. */
    fun findSigunguMonthlyTotals(sidoCode: String, from: LocalDate): List<RegionVisitorRanking.SigunguMonthlyTotal>
}
