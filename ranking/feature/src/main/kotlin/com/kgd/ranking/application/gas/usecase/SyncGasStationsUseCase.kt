package com.kgd.ranking.application.gas.usecase

import com.kgd.ranking.application.gas.dto.GasStationBulkResult
import com.kgd.ranking.application.gas.dto.GasStationUpsertItem

/** 수집기가 보낸 주유소를 적재한다 (ADR-0081 §3). 전체 동기화 — 요청에 없는 필드·유종은 지워진다. */
interface SyncGasStationsUseCase {
    fun execute(command: Command): GasStationBulkResult

    data class Command(val stations: List<GasStationUpsertItem>)
}
