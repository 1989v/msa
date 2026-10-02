package com.kgd.place.application.region.service

import com.kgd.place.application.region.port.RegionVisitorRepositoryPort
import com.kgd.place.application.region.usecase.RegionVisitorUseCase
import com.kgd.place.domain.region.model.RegionVisitorDaily
import com.kgd.place.domain.region.model.RegionVisitorTrend
import org.springframework.cache.annotation.CachePut
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

/**
 * 지역 허브 「방문 추이」. 화면 요청은 레디스에서 나간다 — 적재가 받은 지역의 값을 다시 계산해 덮으므로(write-through)
 * 적재 뒤 첫 요청도 MySQL 을 치지 않는다. 캐시를 놓친 요청만 (수준, 지역) PK 범위 하나를 읽는다 (ADR-0071 §10).
 */
@Service
class RegionVisitorService(
    private val repository: RegionVisitorRepositoryPort,
) : RegionVisitorUseCase {

    @Cacheable(RegionCaches.VISITORS, key = "#code")
    override fun trend(code: String): RegionVisitorUseCase.Trend = load(code)

    /** 적재 경로가 부른다 — 계산한 값으로 캐시 키를 덮는다. 다른 빈([RegionVisitorSyncService])에서 불러야 프록시를 탄다. */
    @CachePut(RegionCaches.VISITORS, key = "#code")
    fun refresh(code: String): RegionVisitorUseCase.Trend = load(code)

    private fun load(code: String): RegionVisitorUseCase.Trend {
        val level = RegionVisitorDaily.requireLevel(code)
        val latest = repository.findLatestDate(level, code)
            ?: return RegionVisitorUseCase.Trend(code, level.name, null, emptyList())
        val months = RegionVisitorTrend.completeMonths(
            repository.findMonthlyTotals(level, code, RegionVisitorTrend.windowStart(latest)),
        )
        return RegionVisitorUseCase.Trend(
            code = code,
            level = level.name,
            latestDate = latest.toString(),
            months = months.map { RegionVisitorUseCase.Month(it.month.toString(), it.local, it.outsider, it.foreigner) },
        )
    }
}
