package com.kgd.place.application.air.service

import com.kgd.place.application.air.port.AirQualityRepositoryPort
import com.kgd.place.application.air.usecase.AirQualityUseCase
import com.kgd.place.application.region.service.RegionCaches
import com.kgd.place.domain.air.model.AirMeasurement
import com.kgd.place.domain.air.model.AirPollutant
import com.kgd.place.domain.air.model.AirQuality
import org.springframework.cache.annotation.CachePut
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

/**
 * 시군구 대기의 캐시 값. 적재가 받은 측정소를 후보로 갖는 시군구의 값을 다시 만들어 덮으므로(write-through) 적재 뒤 첫 요청도
 * MySQL 을 치지 않는다. 캐시를 놓친 요청만 읽는다 — 후보(PK 앞부분) · 측정소 · 측정을 한 번씩(측정소 이름 IN).
 *
 * 캐시에는 신선도로 거르기 **전** 값을 둔다 — 거르는 기준이 읽는 시각이라서다([AirQualityService]).
 */
@Service
class AirQualityLoader(
    private val repository: AirQualityRepositoryPort,
) {

    @Cacheable(RegionCaches.AIR, key = "#sigunguCode")
    fun load(sigunguCode: String): AirQualityUseCase.Air = build(sigunguCode)

    /** 적재 경로가 부른다 — 계산한 값으로 캐시 키를 덮는다. 다른 빈([AirQualitySyncService])에서 불러야 프록시를 탄다. */
    @CachePut(RegionCaches.AIR, key = "#sigunguCode")
    fun refresh(sigunguCode: String): AirQualityUseCase.Air = build(sigunguCode)

    private fun build(sigunguCode: String): AirQualityUseCase.Air {
        val names = repository.findMappings(sigunguCode).map { it.stationName }
        if (names.isEmpty()) return AirQualityUseCase.Air(sigunguCode, emptyList())
        val measured = repository.findMeasurements(names).associateBy { it.stationName }
        val stations = repository.findStations(names).sortedBy { it.stationName }.map {
            AirQualityUseCase.Station(it.stationName, it.latitude, it.longitude, measured[it.stationName]?.toView())
        }
        return AirQualityUseCase.Air(sigunguCode, stations)
    }

    private fun AirMeasurement.toView(): AirQualityUseCase.Measurement? = dataTime?.let { at ->
        AirQualityUseCase.Measurement(
            sidoName = sidoName,
            dataTime = at.toString(),
            pm10 = AirQuality.pollutant(fields, "pm10").toView(),
            pm25 = AirQuality.pollutant(fields, "pm25").toView(),
        )
    }

    private fun AirPollutant.toView() = AirQualityUseCase.Pollutant(value, grade, flag)
}
