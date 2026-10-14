package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.MarketStewardUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/place/markets/{marketId}/steward-applications")
class MarketStewardController(private val stewards: MarketStewardUseCase) {
    private val log = KotlinLogging.logger {}
    @PostMapping
    fun apply(@RequestHeader("X-User-Id") memberId: Long, @PathVariable marketId: Long,
        @RequestBody request: MarketStewardUseCase.Application) = ApiResponse.success(stewards.apply(memberId, marketId, request))
    @GetMapping("/me")
    fun current(@RequestHeader("X-User-Id") memberId: Long, @PathVariable marketId: Long) =
        ApiResponse.success(stewards.current(memberId, marketId))
}
