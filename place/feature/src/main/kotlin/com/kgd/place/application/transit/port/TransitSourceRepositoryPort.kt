package com.kgd.place.application.transit.port

import com.kgd.place.domain.transit.model.BusCoverage
import com.kgd.place.domain.transit.model.TransitBusStop
import com.kgd.place.domain.transit.model.TransitRailStation
import com.kgd.place.domain.transit.model.TransitSource
import com.kgd.place.domain.transit.model.TransitSourceRun
import java.time.LocalDateTime

/** 역·정류장 원천 표(회차 단위)와 활성 회차 · 버스 연계 판정. */
interface TransitSourceRepositoryPort {
    fun findActiveRun(source: TransitSource): TransitSourceRun?

    /** [runId] 회차에서 [rows] 의 자연 키와 같은 행을 지우고 넣는다. 반환은 넣은 행 수. */
    fun putRail(runId: String, rows: List<TransitRailStation>, loadedAt: LocalDateTime): Int

    fun putBus(runId: String, rows: List<TransitBusStop>, loadedAt: LocalDateTime): Int

    fun countRows(source: TransitSource, runId: String): Int

    /** 활성 회차를 [runId] 로 바꾸고 다른 회차의 행을 지운다. 반환은 지운 행 수. */
    fun activate(source: TransitSource, runId: String, rows: Int, activatedAt: LocalDateTime): Int

    /** 연계 판정을 통째로 바꾼다. */
    fun replaceCoverage(rows: List<BusCoverage>, syncedAt: LocalDateTime)
}
