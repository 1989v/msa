package com.kgd.ads.presentation.decision.controller

import com.kgd.ads.application.decision.usecase.GetLegacyPlacementUseCase
import com.kgd.ads.presentation.decision.dto.LegacyPlacementResponse
import com.kgd.common.exception.NotFoundException
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 전환 릴리스 동안만 있는 옛 지면 조회 — game 이 주던 응답 모양 그대로 그 지면의 승인된 HOUSE 소재를 준다.
 * 옛 `subject`(기기 id)별 노출 간격은 두지 않는다 — 배너는 화면이 순환시키고, 결정 API 로 넘어가면 이 경로는 사라진다.
 */
@RestController
@RequestMapping("/api/v1/ads")
class LegacyPlacementController(
    private val getPlacement: GetLegacyPlacementUseCase,
) {
    @GetMapping("/placements/{placementKey}")
    fun placement(
        @PathVariable placementKey: String,
        @Suppress("UNUSED_PARAMETER") @RequestParam(required = false) subject: String?,
    ): ApiResponse<LegacyPlacementResponse> {
        val placement = getPlacement.execute(placementKey) ?: throw NotFoundException("광고 지면", placementKey)
        return ApiResponse.success(LegacyPlacementResponse.from(placement))
    }
}
