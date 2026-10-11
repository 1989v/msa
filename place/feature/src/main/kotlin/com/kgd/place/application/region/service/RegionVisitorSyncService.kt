package com.kgd.place.application.region.service

import com.kgd.place.application.region.port.RegionVisitorRepositoryPort
import com.kgd.place.application.region.usecase.SyncRegionVisitorsUseCase
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.region.model.RegionVisitorDaily
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val log = KotlinLogging.logger {}

/**
 * 지역 방문자 적재. 저장(트랜잭션)이 끝난 **뒤** 받은 지역의 허브 캐시를 다시 채운다 — 트랜잭션 안에서 덮으면
 * 롤백된 값이 캐시에 남는다. 캐시 쓰기가 실패해도 적재는 성공이고, 그 지역은 TTL 뒤 캐시를 놓친 요청이 다시 채운다.
 */
@Service
class RegionVisitorSyncService(
    private val repository: RegionVisitorRepositoryPort,
    private val trends: RegionVisitorService,
    private val rankings: RegionVisitorRankingService,
) : SyncRegionVisitorsUseCase {

    override fun apply(items: List<SyncRegionVisitorsUseCase.Item>): SyncRegionVisitorsUseCase.Applied {
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val rows = items.map {
            RegionVisitorDaily(
                level = AdministrativeRegionLevel.valueOf(it.level),
                regionCode = it.regionCode.trim(),
                baseDate = LocalDate.parse(it.baseYmd, BASIC_ISO),
                touDivCd = it.touDivCd.trim(),
                touNum = it.touNum.trim(),
                regionName = it.regionName,
                touDivNm = it.touDivNm,
                daywkDivCd = it.daywkDivCd,
                daywkDivNm = it.daywkDivNm,
            )
        }
        val applied = repository.upsertAll(rows, LocalDateTime.now(KST))
        val codes = rows.map { it.regionCode }.distinct()
        codes.forEach { trends.refresh(it) }
        // 시도 순위는 그 시도 시군구 전부를 보고 정하므로, 받은 행의 시도마다 다시 계산한다
        codes.map { it.take(2) }.distinct().forEach { rankings.refresh(it) }
        log.info { "지역 방문자: 적재 $applied · 캐시 갱신 지역 ${codes.size} · 날짜 ${rows.minOf { it.baseDate }}~${rows.maxOf { it.baseDate }}" }
        return SyncRegionVisitorsUseCase.Applied(applied, codes.size)
    }

    private companion object {
        val BASIC_ISO: DateTimeFormatter = DateTimeFormatter.BASIC_ISO_DATE
        val KST: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
