package com.kgd.place.application.air.service

import com.kgd.place.application.air.port.AirQualityRepositoryPort
import com.kgd.place.application.air.usecase.SyncAirQualityUseCase
import com.kgd.place.domain.air.model.AirQuality
import com.kgd.place.domain.air.model.AirStation
import com.kgd.place.domain.air.model.AirStationMapping
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.LocalDateTime
import java.time.ZoneId

private val log = KotlinLogging.logger {}

/**
 * 대기 적재. 저장(트랜잭션)이 끝난 **뒤** 받은 측정소를 쓰는 시군구의 캐시를 다시 채운다 — 트랜잭션 안에서 덮으면
 * 롤백된 값이 캐시에 남는다. 캐시 쓰기가 실패해도 적재는 성공이고, 그 시군구는 TTL 뒤 캐시를 놓친 요청이 다시 채운다.
 */
@Service
class AirQualitySyncService(
    private val repository: AirQualityRepositoryPort,
    private val loader: AirQualityLoader,
) : SyncAirQualityUseCase {

    override fun applyStations(
        stations: List<SyncAirQualityUseCase.StationItem>,
        mappings: List<SyncAirQualityUseCase.MappingItem>,
    ): SyncAirQualityUseCase.StationsApplied {
        require(stations.isNotEmpty()) { "stations 는 비어있을 수 없습니다" }
        val now = now()
        val applied = repository.upsertStations(
            stations.map { AirQualityRepositoryPort.StationRaw(AirStation(it.stationName.trim(), it.latitude, it.longitude), it.itemRaw) },
            now,
        )
        val mapped = repository.replaceMappings(
            mappings.map { AirStationMapping(it.sigunguCode.trim(), it.stationName.trim(), it.distanceM, it.attractions) },
            now,
        )
        val sigungu = mappings.map { it.sigunguCode.trim() }.distinct()
        sigungu.forEach { loader.refresh(it) }
        log.info { "대기 측정소: $applied · 시군구 후보 $mapped · 캐시 갱신 시군구 ${sigungu.size}" }
        return SyncAirQualityUseCase.StationsApplied(applied, mapped, sigungu.size)
    }

    override fun applyMeasurements(items: List<SyncAirQualityUseCase.MeasurementItem>): SyncAirQualityUseCase.Applied {
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val rows = items.map {
            AirQualityRepositoryPort.MeasurementRaw(it.sidoName.trim(), it.stationName.trim(), AirQuality.parseDataTime(it.dataTime), it.itemRaw)
        }
        val applied = repository.upsertMeasurements(rows, now())
        val sigungu = repository.findSigunguByStations(rows.map { it.stationName }.distinct()).distinct()
        sigungu.forEach { loader.refresh(it) }
        log.info { "대기 측정: 측정소 $applied · 측정 시각 ${rows.groupingBy { it.dataTime }.eachCount()} · 캐시 갱신 시군구 ${sigungu.size}" }
        return SyncAirQualityUseCase.Applied(applied, sigungu.size)
    }

    private fun now(): LocalDateTime = LocalDateTime.now(KST)

    private companion object {
        val KST: ZoneId = ZoneId.of("Asia/Seoul")
    }
}
