package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.MarketGeometryRequestUseCase
import com.kgd.place.domain.market.model.GeometryRequestStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/place/markets/{id}/manage/geometry-requests")
class MarketGeometryRequestController(private val requests: MarketGeometryRequestUseCase) {
    @PostMapping
    fun submit(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestBody input: MarketGeometryRequestUseCase.Submission) = ApiResponse.success(requests.submit(memberId, id, input))
    @GetMapping
    fun list(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long) = ApiResponse.success(requests.forMarket(memberId, id))
}

/** Gateway ROLE_ADMIN policy protects this path. Approval never applies geometry. */
@RestController
@RequestMapping("/api/v1/admin/place/markets/geometry-requests")
class MarketGeometryRequestAdminController(private val requests: MarketGeometryRequestUseCase) {
    @GetMapping
    fun list(@RequestHeader("X-User-Id") memberId: Long, @RequestParam(required = false) status: GeometryRequestStatus?) =
        ApiResponse.success(requests.list(memberId, status))
    @PutMapping("/{id}")
    fun decide(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestBody input: MarketGeometryRequestUseCase.Decision) = ApiResponse.success(requests.decide(memberId, id, input))
}
