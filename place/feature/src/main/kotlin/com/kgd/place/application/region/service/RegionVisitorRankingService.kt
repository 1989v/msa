package com.kgd.place.application.region.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.application.region.port.RegionVisitorRepositoryPort
import com.kgd.place.application.region.usecase.RegionVisitorRankingUseCase
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorRanking
import org.springframework.cache.annotation.CachePut
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

/**
 * 시도 「타지 방문자가 많은 시군구」. 방문 추이([RegionVisitorService])와 같은 경로다 — 적재가 받은 시도의 값을
 * 다시 계산해 덮고(write-through), 캐시를 놓친 요청만 시도 접두 범위 하나를 읽는다.
 */
@Service
class RegionVisitorRankingService(
    private val visitors: RegionVisitorRepositoryPort,
    private val regions: AdministrativeRegionRepositoryPort,
) : RegionVisitorRankingUseCase {

    @Cacheable(RegionCaches.VISITOR_RANKING, key = "#sidoCode")
    override fun ranking(sidoCode: String): RegionVisitorRankingUseCase.Ranking =
        load(sidoCode) ?: throw BusinessException(ErrorCode.INVALID_INPUT, "시도 코드가 아니다: $sidoCode")

    /**
     * 적재 경로가 부른다 — 계산한 값으로 캐시 키를 덮는다. 지금 시도가 아닌 코드(통합 전 옛 코드 29·46)는 null 이고
     * 키를 만들지 않는다. 다른 빈([RegionVisitorSyncService])에서 불러야 프록시를 탄다.
     */
    @CachePut(RegionCaches.VISITOR_RANKING, key = "#sidoCode", unless = "#result == null")
    fun refresh(sidoCode: String): RegionVisitorRankingUseCase.Ranking? = load(sidoCode)

    private fun load(sidoCode: String): RegionVisitorRankingUseCase.Ranking? {
        if (sidoCode.length != 2 || !sidoCode.all(Char::isDigit)) return null
        if (regions.findByLevel(AdministrativeRegionLevel.SIDO).none { it.code == sidoCode }) return null
        val children = regions.findChildren(sidoCode)
        if (children.size < RegionVisitorRanking.MIN_SIGUNGU) return EMPTY
        val latest = visitors.findLatestSigunguDate(sidoCode) ?: return EMPTY
        val result = RegionVisitorRanking.rank(
            children.map { it.code },
            visitors.findSigunguMonthlyTotals(sidoCode, RegionVisitorRanking.windowStart(latest)),
        )
        val byCode = children.associateBy { it.code }
        return RegionVisitorRankingUseCase.Ranking(
            month = result.month?.toString(),
            items = result.entries.map {
                val region = byCode.getValue(it.code)
                RegionVisitorRankingUseCase.Item(it.code, region.name, region.nameEn, it.outsiders, it.foreigners, it.total)
            },
        )
    }

    private companion object {
        val EMPTY = RegionVisitorRankingUseCase.Ranking(null, emptyList())
    }
}
