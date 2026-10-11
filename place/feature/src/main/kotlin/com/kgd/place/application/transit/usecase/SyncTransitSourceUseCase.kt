package com.kgd.place.application.transit.usecase

import com.kgd.place.domain.transit.model.BusCoverage
import com.kgd.place.domain.transit.model.TransitBusStop
import com.kgd.place.domain.transit.model.TransitRailStation
import com.kgd.place.domain.transit.model.TransitSource
import java.time.LocalDateTime

/**
 * 역·정류장 원천 적재 — place-ingest `--job=transit-stops` 만 부른다. 원천 교체는 적재 회차 단위다:
 * 새 회차로 묶음을 쌓고([putRail]·[putBus]), 다 들어가면 [activate] 한 번으로 활성 회차를 바꾸고 옛 회차를 지운다.
 * 활성화 전의 행은 아무도 읽지 않으므로 중간 묶음이 실패해도 활성 회차가 그대로다.
 */
interface SyncTransitSourceUseCase {
    fun state(source: TransitSource): State

    /** [runId] 회차에 묶음을 쌓는다. 같은 자연 키는 덮는다(같은 묶음 재전송이 안전하다). 활성 회차에는 쓰지 않는다(400). 반환은 쌓은 행 수. */
    fun putRail(runId: String, rows: List<TransitRailStation>): Int

    fun putBus(runId: String, rows: List<TransitBusStop>): Int

    /**
     * [runId] 회차의 행 수가 [expectedRows] 와 같을 때만 활성으로 바꾸고 다른 회차 행을 지운다. 어긋나거나 0행이면 400 이고 이전 회차가 그대로다.
     * 버스는 [coverage](시군구 연계 판정)를 함께 통째로 바꾼다 — 철도에 주면 400.
     */
    fun activate(source: TransitSource, runId: String, expectedRows: Int, coverage: List<BusCoverage>?): Activated

    /** 받은 적 없으면 [runId]·[rows]·[activatedAt] 이 null. */
    data class State(val source: TransitSource, val runId: String?, val rows: Int?, val activatedAt: LocalDateTime?)

    data class Activated(val source: TransitSource, val runId: String, val rows: Int, val removed: Int, val coverage: Int)
}
