package com.kgd.place.infrastructure.persistence.region.adapter

import com.kgd.place.application.region.port.RegionVisitorRepositoryPort
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorDaily
import com.kgd.place.domain.region.model.RegionVisitorTrend
import com.kgd.place.infrastructure.persistence.region.repository.RegionVisitorDailyJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth

@Component
class RegionVisitorRepositoryAdapter(
    private val repository: RegionVisitorDailyJpaRepository,
) : RegionVisitorRepositoryPort {

    @Transactional
    override fun upsertAll(rows: List<RegionVisitorDaily>, syncedAt: LocalDateTime): Int {
        rows.forEach {
            repository.upsert(
                level = it.level.name, code = it.regionCode, baseYmd = it.baseDate, touDivCd = it.touDivCd,
                touNum = it.touNum, touNumValue = it.touNumValue, regionNm = it.regionName, touDivNm = it.touDivNm,
                daywkDivCd = it.daywkDivCd, daywkDivNm = it.daywkDivNm, syncedAt = syncedAt,
            )
        }
        return rows.size
    }

    override fun findLatestDate(level: AdministrativeRegionLevel, code: String): LocalDate? =
        repository.findLatestDate(level, code)

    override fun findMonthlyTotals(level: AdministrativeRegionLevel, code: String, from: LocalDate): List<RegionVisitorTrend.MonthlyTotal> =
        repository.findMonthlyTotals(level.name, code, from).map {
            RegionVisitorTrend.MonthlyTotal(YearMonth.parse(it.getMonth()), it.getTouDivCd(), it.getTotal(), it.getDays().toInt())
        }
}
