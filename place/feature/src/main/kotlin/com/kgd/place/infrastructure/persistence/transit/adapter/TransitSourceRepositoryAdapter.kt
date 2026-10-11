package com.kgd.place.infrastructure.persistence.transit.adapter

import com.kgd.place.application.transit.port.TransitSourceRepositoryPort
import com.kgd.place.domain.transit.model.BusCoverage
import com.kgd.place.domain.transit.model.TransitBusStop
import com.kgd.place.domain.transit.model.TransitRailStation
import com.kgd.place.domain.transit.model.TransitSource
import com.kgd.place.domain.transit.model.TransitSourceRun
import com.kgd.place.infrastructure.persistence.transit.entity.TransitBusCoverageJpaEntity
import com.kgd.place.infrastructure.persistence.transit.entity.TransitBusStopJpaEntity
import com.kgd.place.infrastructure.persistence.transit.entity.TransitRailStationJpaEntity
import com.kgd.place.infrastructure.persistence.transit.entity.TransitSourceRunJpaEntity
import com.kgd.place.infrastructure.persistence.transit.repository.TransitBusCoverageJpaRepository
import com.kgd.place.infrastructure.persistence.transit.repository.TransitBusStopJpaRepository
import com.kgd.place.infrastructure.persistence.transit.repository.TransitRailStationJpaRepository
import com.kgd.place.infrastructure.persistence.transit.repository.TransitSourceRunJpaRepository
import org.springframework.stereotype.Component
import java.time.LocalDateTime

@Component
class TransitSourceRepositoryAdapter(
    private val rail: TransitRailStationJpaRepository,
    private val bus: TransitBusStopJpaRepository,
    private val runs: TransitSourceRunJpaRepository,
    private val coverage: TransitBusCoverageJpaRepository,
) : TransitSourceRepositoryPort {

    override fun findActiveRun(source: TransitSource): TransitSourceRun? =
        runs.findById(source.name).orElse(null)?.let { TransitSourceRun(source, it.runId, it.rowCount, it.activatedAt) }

    override fun putRail(runId: String, rows: List<TransitRailStation>, loadedAt: LocalDateTime): Int {
        rail.deleteByRunAndKeys(runId, rows.map { it.sourceKey })
        rail.saveAll(
            rows.map {
                TransitRailStationJpaEntity(
                    loadRunId = runId, sourceKey = it.sourceKey, stationNo = it.stationNo, stationName = it.stationName,
                    lineNo = it.lineNo, lineName = it.lineName, stationNameEn = it.stationNameEn, stationNameHanja = it.stationNameHanja,
                    transferType = it.transferType, transferLineNo = it.transferLineNo, transferLineName = it.transferLineName,
                    latRaw = it.latRaw, lngRaw = it.lngRaw, operatorName = it.operatorName, roadAddress = it.roadAddress, phone = it.phone,
                    baseDateRaw = it.baseDateRaw, latValue = it.latValue, lngValue = it.lngValue, validCoord = it.validCoord,
                    baseDate = it.baseDate, loadedAt = loadedAt,
                )
            },
        )
        return rows.size
    }

    override fun putBus(runId: String, rows: List<TransitBusStop>, loadedAt: LocalDateTime): Int {
        bus.deleteByRunAndKeys(runId, rows.map { it.sourceKey })
        bus.saveAll(
            rows.map {
                TransitBusStopJpaEntity(
                    loadRunId = runId, sourceKey = it.sourceKey, stopNo = it.stopNo, stopName = it.stopName, latRaw = it.latRaw,
                    lngRaw = it.lngRaw, collectedDateRaw = it.collectedDateRaw, mobileShortNo = it.mobileShortNo, cityCode = it.cityCode,
                    cityName = it.cityName, manageCityName = it.manageCityName, latValue = it.latValue, lngValue = it.lngValue,
                    validCoord = it.validCoord, collectedDate = it.collectedDate, loadedAt = loadedAt,
                )
            },
        )
        return rows.size
    }

    override fun countRows(source: TransitSource, runId: String): Int =
        when (source) {
            TransitSource.RAIL -> rail.countByLoadRunId(runId)
            TransitSource.BUS -> bus.countByLoadRunId(runId)
        }.toInt()

    override fun activate(source: TransitSource, runId: String, rows: Int, activatedAt: LocalDateTime): Int {
        val run = runs.findById(source.name).orElse(null)
        if (run == null) {
            runs.save(TransitSourceRunJpaEntity(source.name, runId, rows, activatedAt))
        } else {
            run.runId = runId
            run.rowCount = rows
            run.activatedAt = activatedAt
        }
        return when (source) {
            TransitSource.RAIL -> rail.deleteOtherRuns(runId)
            TransitSource.BUS -> bus.deleteOtherRuns(runId)
        }
    }

    override fun replaceCoverage(rows: List<BusCoverage>, syncedAt: LocalDateTime) {
        coverage.deleteAllRows()
        coverage.saveAll(rows.map { TransitBusCoverageJpaEntity(it.sigunguCode, it.stops, it.covered, syncedAt) })
    }
}
