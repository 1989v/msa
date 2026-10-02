package com.kgd.place.infrastructure.persistence.air.adapter

import com.kgd.place.application.air.port.AirQualityRepositoryPort
import com.kgd.place.domain.air.model.AirMeasurement
import com.kgd.place.domain.air.model.AirStation
import com.kgd.place.domain.air.model.AirStationMapping
import com.kgd.place.infrastructure.persistence.air.repository.AirMeasurementJpaRepository
import com.kgd.place.infrastructure.persistence.air.repository.AirStationJpaRepository
import com.kgd.place.infrastructure.persistence.air.repository.AirStationSigunguJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.time.LocalDateTime

@Component
class AirQualityRepositoryAdapter(
    private val stations: AirStationJpaRepository,
    private val measurements: AirMeasurementJpaRepository,
    private val mappings: AirStationSigunguJpaRepository,
) : AirQualityRepositoryPort {

    @Transactional
    override fun upsertStations(rows: List<AirQualityRepositoryPort.StationRaw>, syncedAt: LocalDateTime): Int {
        rows.forEach { stations.upsert(it.station.stationName, it.station.latitude, it.station.longitude, it.itemRaw, syncedAt) }
        return rows.size
    }

    @Transactional
    override fun replaceMappings(mappings: List<AirStationMapping>, syncedAt: LocalDateTime): Int {
        val codes = mappings.map { it.sigunguCode }.distinct()
        if (codes.isEmpty()) return 0
        this.mappings.deleteBySigungu(codes)
        mappings.forEach { this.mappings.insert(it.sigunguCode, it.stationName, it.distanceM, it.attractions, syncedAt) }
        return mappings.size
    }

    @Transactional
    override fun upsertMeasurements(rows: List<AirQualityRepositoryPort.MeasurementRaw>, fetchedAt: LocalDateTime): Int {
        rows.forEach { measurements.upsert(it.stationName, it.sidoName, it.dataTime, it.itemRaw, fetchedAt) }
        return rows.size
    }

    override fun findMappings(sigunguCode: String): List<AirStationMapping> =
        mappings.findByIdSigunguCode(sigunguCode).map {
            AirStationMapping(it.id.sigunguCode, it.id.stationName, it.distanceM, it.attractions)
        }

    override fun findStations(stationNames: Collection<String>): List<AirStation> =
        if (stationNames.isEmpty()) emptyList()
        else stations.findAllById(stationNames).map { AirStation(it.stationName, it.latitude, it.longitude) }

    override fun findMeasurements(stationNames: Collection<String>): List<AirMeasurement> =
        if (stationNames.isEmpty()) emptyList()
        else measurements.findAllById(stationNames).map { AirMeasurement(it.sidoName, it.stationName, it.dataTime, fields(it.itemRaw)) }

    override fun findSigunguByStations(stationNames: Collection<String>): List<String> =
        if (stationNames.isEmpty()) emptyList() else mappings.findCodesByStations(stationNames)

    companion object {
        // Spring 빈을 주입받지 않는다 — 원문 객체를 맵으로 펴기만 하므로 설정이 필요 없다
        private val json = JsonMapper.builder().build()

        /** 측정 행 원문 → 키·값 문자열. 원천은 값을 전부 문자열(또는 null)로 준다 — 그대로 옮긴다. */
        fun fields(raw: String): Map<String, String?> =
            json.readValue(raw, Map::class.java).entries.associate { (k, v) -> k.toString() to v?.toString() }
    }
}
