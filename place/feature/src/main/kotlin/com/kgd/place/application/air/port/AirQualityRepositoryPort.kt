package com.kgd.place.application.air.port

import com.kgd.place.domain.air.model.AirMeasurement
import com.kgd.place.domain.air.model.AirStation
import com.kgd.place.domain.air.model.AirStationMapping
import java.time.LocalDateTime

/** 대기 표 셋(`air_station` · `air_measurement` · `air_station_sigungu`). 보내지 않은 측정소·시군구는 지우지 않는다. */
interface AirQualityRepositoryPort {

    fun upsertStations(rows: List<StationRaw>, syncedAt: LocalDateTime): Int

    /** 받은 시군구의 후보를 통째로 바꾼다(그 시군구의 옛 후보는 지운다). 반환은 넣은 행 수. */
    fun replaceMappings(mappings: List<AirStationMapping>, syncedAt: LocalDateTime): Int

    /** 측정소마다 최신 한 행. 저장된 측정보다 오래된 측정(늦게 온 재실행)은 덮지 않는다. 반환은 보낸 행 수. */
    fun upsertMeasurements(rows: List<MeasurementRaw>, fetchedAt: LocalDateTime): Int

    fun findMappings(sigunguCode: String): List<AirStationMapping>

    fun findStations(stationNames: Collection<String>): List<AirStation>

    fun findMeasurements(stationNames: Collection<String>): List<AirMeasurement>

    /** 이 측정소들을 후보로 갖는 시군구 — 측정 적재 뒤 캐시를 다시 채울 대상. */
    fun findSigunguByStations(stationNames: Collection<String>): List<String>

    /** [itemRaw] 는 getMsrstnList 행 원문 JSON. */
    data class StationRaw(val station: AirStation, val itemRaw: String)

    /** [itemRaw] 는 getCtprvnRltmMesureDnsty 행 원문 JSON. [dataTime] 이 null 이면 그 측정소의 이번 측정이 없다. */
    data class MeasurementRaw(val sidoName: String, val stationName: String, val dataTime: LocalDateTime?, val itemRaw: String)
}
