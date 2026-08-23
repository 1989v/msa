package com.kgd.ranking.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.ranking.application.dto.GasStationBulkRequest
import com.kgd.ranking.application.dto.GasStationBulkResult
import com.kgd.ranking.application.service.GasBoardRebuildService
import com.kgd.ranking.application.service.GasStationSyncService
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 수집기 전용 적재 엔드포인트 (ADR-0081 §3).
 *
 * `/internal` 하위는 ingress 에 노출하지 않는다 — 클러스터 안에서만 닿는다
 * (place 의 내부 관광지 적재 엔드포인트와 같은 규약).
 */
@RestController
@RequestMapping("/internal/ranking/gas")
class RankingInternalController(
    private val gasStationSyncService: GasStationSyncService,
    private val gasBoardRebuildService: GasBoardRebuildService,
) {

    @PostMapping("/stations/bulk")
    fun bulkUpsert(@Valid @RequestBody request: GasStationBulkRequest): ApiResponse<GasStationBulkResult> =
        ApiResponse.success(gasStationSyncService.upsert(request.stations))

    /** 적재분으로 시군구 × 유종 보드 스냅샷을 다시 만든다. 수집 직후 같은 잡이 부른다. */
    @PostMapping("/boards/rebuild")
    fun rebuildBoards(@RequestBody request: BoardRebuildRequest): ApiResponse<Map<String, Int>> =
        ApiResponse.success(gasBoardRebuildService.rebuildAll(request.sourceLabel))
}

data class BoardRebuildRequest(val sourceLabel: String)
