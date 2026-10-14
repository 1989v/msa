package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.EditMarketUseCase
import com.kgd.place.application.market.usecase.MarketStewardUseCase
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.web.bind.annotation.*

/** Login is checked by gateway; market grants are resolved from DB on every request. */
@RestController
@RequestMapping("/api/v1/place/markets/{id}/manage")
class MarketManageController(private val edit: EditMarketUseCase, private val stewards: MarketStewardUseCase) {
    private val log = KotlinLogging.logger {}
    private fun actor(memberId: Long, id: Long) = stewards.actor(memberId, id)

    @GetMapping
    fun detail(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long) = ApiResponse.success(edit.detail(actor(memberId, id), id))
    @PutMapping("/stores/{storeId}/override")
    fun override(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable storeId: Long,
        @RequestBody request: EditMarketUseCase.OverrideRequest): ApiResponse<Unit> {
        edit.override(actor(memberId, id), id, storeId, request); return ApiResponse.success(Unit)
    }
    @PostMapping("/stores")
    fun createStore(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestBody request: EditMarketUseCase.ManualStoreRequest) = ApiResponse.success(edit.manualStore(actor(memberId, id), id, null, request))
    @PutMapping("/stores/{storeId}")
    fun updateStore(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable storeId: Long,
        @RequestBody request: EditMarketUseCase.ManualStoreRequest) = ApiResponse.success(edit.manualStore(actor(memberId, id), id, storeId, request))
    @DeleteMapping("/stores/{storeId}")
    fun deleteStore(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable storeId: Long): ApiResponse<Unit> {
        edit.deleteStore(actor(memberId, id), id, storeId); return ApiResponse.success(Unit)
    }
    @PutMapping("/zones")
    fun createZone(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestBody request: EditMarketUseCase.ZoneRequest) = ApiResponse.success(edit.zone(actor(memberId, id), id, null, request))
    @PutMapping("/zones/{zoneId}")
    fun updateZone(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable zoneId: Long,
        @RequestBody request: EditMarketUseCase.ZoneRequest) = ApiResponse.success(edit.zone(actor(memberId, id), id, zoneId, request))
    @DeleteMapping("/zones/{zoneId}")
    fun deleteZone(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable zoneId: Long): ApiResponse<Unit> {
        actor(memberId, id); throw BusinessException(ErrorCode.FORBIDDEN)
    }
    @PutMapping("/zones/order")
    fun order(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @RequestBody ids: List<Long>): ApiResponse<Unit> {
        edit.orderZones(actor(memberId, id), id, ids); return ApiResponse.success(Unit)
    }
    @GetMapping("/changes")
    fun history(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestParam(defaultValue = "0") page: Int, @RequestParam(defaultValue = "20") size: Int) =
        ApiResponse.success(edit.history(actor(memberId, id), id, page, size))
    @PostMapping("/changes/{logId}/revert")
    fun revert(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable logId: Long): ApiResponse<Unit> {
        actor(memberId, id); throw BusinessException(ErrorCode.FORBIDDEN)
    }
}
