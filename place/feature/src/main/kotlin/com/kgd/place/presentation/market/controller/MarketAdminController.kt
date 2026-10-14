package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.EditMarketUseCase
import com.kgd.place.application.market.usecase.MarketEditorActor
import com.kgd.place.domain.market.model.MarketActorKind
import org.springframework.web.bind.annotation.*

/** ROLE_ADMIN is checked by gateway; its trusted X-User-Id identifies every reader/writer. */
@RestController
@RequestMapping("/api/v1/admin/place/markets")
class MarketAdminController(private val edit: EditMarketUseCase) {
    private fun actor(memberId: Long) = MarketEditorActor(MarketActorKind.ADMIN, memberId)

    @GetMapping
    fun list(@RequestHeader("X-User-Id") memberId: Long, @RequestParam(defaultValue = "") name: String,
        @RequestParam(defaultValue = "0") page: Int, @RequestParam(defaultValue = "20") size: Int) =
        ApiResponse.success(edit.list(actor(memberId), name, page, size))
    @GetMapping("/{id}")
    fun detail(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long) = ApiResponse.success(edit.detail(actor(memberId), id))
    @PutMapping("/{id}/stores/{storeId}/override")
    fun override(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable storeId: Long,
        @RequestBody request: EditMarketUseCase.OverrideRequest): ApiResponse<Unit> {
        edit.override(actor(memberId), id, storeId, request); return ApiResponse.success(Unit)
    }
    @PostMapping("/{id}/stores")
    fun createStore(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestBody request: EditMarketUseCase.ManualStoreRequest) = ApiResponse.success(edit.manualStore(actor(memberId), id, null, request))
    @PutMapping("/{id}/stores/{storeId}")
    fun updateStore(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable storeId: Long,
        @RequestBody request: EditMarketUseCase.ManualStoreRequest) = ApiResponse.success(edit.manualStore(actor(memberId), id, storeId, request))
    @DeleteMapping("/{id}/stores/{storeId}")
    fun deleteStore(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable storeId: Long): ApiResponse<Unit> {
        edit.deleteStore(actor(memberId), id, storeId); return ApiResponse.success(Unit)
    }
    @PutMapping("/{id}/zones")
    fun createZone(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestBody request: EditMarketUseCase.ZoneRequest) = ApiResponse.success(edit.zone(actor(memberId), id, null, request))
    @PutMapping("/{id}/zones/{zoneId}")
    fun updateZone(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable zoneId: Long,
        @RequestBody request: EditMarketUseCase.ZoneRequest) = ApiResponse.success(edit.zone(actor(memberId), id, zoneId, request))
    @DeleteMapping("/{id}/zones/{zoneId}")
    fun deleteZone(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable zoneId: Long): ApiResponse<Unit> {
        edit.deleteZone(actor(memberId), id, zoneId); return ApiResponse.success(Unit)
    }
    @PutMapping("/{id}/zones/order")
    fun order(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @RequestBody ids: List<Long>): ApiResponse<Unit> {
        edit.orderZones(actor(memberId), id, ids); return ApiResponse.success(Unit)
    }
    @GetMapping("/{id}/changes")
    fun history(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long,
        @RequestParam(defaultValue = "0") page: Int, @RequestParam(defaultValue = "20") size: Int) =
        ApiResponse.success(edit.history(actor(memberId), id, page, size))
    @PostMapping("/{id}/changes/{logId}/revert")
    fun revert(@RequestHeader("X-User-Id") memberId: Long, @PathVariable id: Long, @PathVariable logId: Long): ApiResponse<Unit> {
        edit.revert(actor(memberId), id, logId); return ApiResponse.success(Unit)
    }
}
