package com.kgd.place.application.weather.service

import com.kgd.place.application.weather.port.WeatherRepositoryPort
import com.kgd.place.application.weather.usecase.SyncWeatherUseCase
import com.kgd.place.domain.weather.model.MidKind
import com.kgd.place.domain.weather.model.MidRegion
import com.kgd.place.domain.weather.model.WeatherArea
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val log = KotlinLogging.logger {}

/**
 * 날씨 적재. 저장(트랜잭션)이 끝난 **뒤** 받은 격자·구역을 쓰는 시군구의 캐시를 다시 채운다 — 트랜잭션 안에서 덮으면
 * 롤백된 값이 캐시에 남는다. 캐시 쓰기가 실패해도 적재는 성공이고, 그 시군구는 TTL 뒤 캐시를 놓친 요청이 다시 채운다.
 */
@Service
class WeatherSyncService(
    private val repository: WeatherRepositoryPort,
    private val loader: WeatherOutlookLoader,
) : SyncWeatherUseCase {

    override fun applyAreas(
        midRegions: List<SyncWeatherUseCase.MidRegionItem>,
        areas: List<SyncWeatherUseCase.AreaItem>,
    ): SyncWeatherUseCase.AreasApplied {
        val regions = repository.upsertMidRegions(midRegions.map { MidRegion(it.regId.trim(), MidKind.valueOf(it.kind), it.name) })
        val applied = repository.upsertAreas(
            areas.map { WeatherArea(it.sigunguCode.trim(), it.nx, it.ny, it.landRegId, it.taRegId, it.taMatch) },
            now(),
        )
        log.info { "날씨 단위: 시군구 $applied · 중기 구역 $regions" }
        return SyncWeatherUseCase.AreasApplied(applied, regions)
    }

    override fun applyShort(items: List<SyncWeatherUseCase.ShortItem>): SyncWeatherUseCase.Applied {
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val rows = items.map {
            WeatherRepositoryPort.ShortRaw(it.nx, it.ny, LocalDateTime.parse(it.baseDate + it.baseTime, ISSUED), it.itemsRaw)
        }
        val applied = repository.upsertShort(rows, now())
        val sigungu = repository.findSigunguByGrids(rows.map { it.nx to it.ny }.distinct()).distinct()
        sigungu.forEach { loader.refresh(it) }
        log.info { "단기예보: 격자 $applied · 발표 ${rows.map { it.baseAt }.distinct()} · 캐시 갱신 시군구 ${sigungu.size}" }
        return SyncWeatherUseCase.Applied(applied, sigungu.size)
    }

    override fun applyMid(items: List<SyncWeatherUseCase.MidItem>): SyncWeatherUseCase.Applied {
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val rows = items.map {
            WeatherRepositoryPort.MidRaw(it.regId.trim(), MidKind.valueOf(it.kind), LocalDateTime.parse(it.tmFc, ISSUED), it.itemRaw)
        }
        val applied = repository.upsertMid(rows, now())
        val sigungu = repository.findSigunguByMidRegions(rows.map { it.regId }.distinct()).distinct()
        sigungu.forEach { loader.refresh(it) }
        log.info { "중기예보: 구역 $applied · 발표 ${rows.map { it.tmFc }.distinct()} · 캐시 갱신 시군구 ${sigungu.size}" }
        return SyncWeatherUseCase.Applied(applied, sigungu.size)
    }

    private fun now(): LocalDateTime = LocalDateTime.now(KST)

    private companion object {
        val ISSUED: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmm")
        val KST: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
