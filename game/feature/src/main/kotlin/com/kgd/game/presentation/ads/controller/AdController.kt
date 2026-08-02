package com.kgd.game.presentation.ads.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.ads.service.AdPlacementDto
import com.kgd.game.application.ads.service.AdService
import com.kgd.game.application.ads.service.RewardDto
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

data class IssueRewardRequest(
    @field:NotBlank val gameSlug: String,
    @field:NotBlank val placementKey: String,
    val sessionKey: String? = null,
)

@RestController
@RequestMapping("/api/v1/ads")
class AdController(
    private val adService: AdService,
) {

    /** 슬롯 조회 — frequency cap 에 걸리면 data=null (FE 는 배너 미노출) */
    @GetMapping("/placements/{placementKey}")
    fun placement(
        @PathVariable placementKey: String,
        @RequestParam subject: String,
    ): ApiResponse<AdPlacementDto?> =
        ApiResponse.success(adService.getServablePlacement(placementKey, subject))

    @PostMapping("/rewards")
    fun issueReward(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @Valid @RequestBody request: IssueRewardRequest,
    ): ApiResponse<RewardDto> =
        ApiResponse.success(
            adService.issueReward(
                gameSlug = request.gameSlug,
                placementKey = request.placementKey,
                sessionKey = request.sessionKey,
                memberId = userId?.toLongOrNull(),
            )
        )

    @PostMapping("/rewards/{rewardKey}/complete")
    fun completeReward(@PathVariable rewardKey: String): ApiResponse<RewardDto> =
        ApiResponse.success(adService.completeReward(rewardKey))
}
