package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.MarketStewardUseCase
import com.kgd.place.domain.market.model.MarketStewardStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.web.bind.annotation.*

/** Gateway's existing ROLE_ADMIN filter protects this entire path. */
@RestController
@RequestMapping("/api/v1/admin/place/stewards")
class MarketStewardAdminController(private val stewards: MarketStewardUseCase) {
    private val log = KotlinLogging.logger {}
    @GetMapping
    fun list(@RequestHeader("X-User-Id") memberId: Long, @RequestParam(required = false) status: MarketStewardStatus?,
        @RequestParam(defaultValue = "0") page: Int, @RequestParam(defaultValue = "20") size: Int) =
        ApiResponse.success(stewards.list(memberId, status, page, size))
    @PutMapping("/{id}")
    fun decide(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestBody request: MarketStewardUseCase.Decision) = ApiResponse.success(stewards.decide(memberId, id, request.action))
}
