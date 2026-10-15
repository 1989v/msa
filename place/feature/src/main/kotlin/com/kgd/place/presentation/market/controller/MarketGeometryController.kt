package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/admin/place/markets/{marketId}")
class MarketGeometryController(private val geometry: MarketGeometryUseCase) {
    private fun actor(id: Long) = MarketEditorActor(MarketActorKind.ADMIN, id)
    @GetMapping("/geometry")
    fun get(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long) = ApiResponse.success(geometry.geometry(actor(user), marketId))
    @PutMapping("/boundary")
    fun boundary(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.BOUNDARY, null, request, request.reason))
    @PostMapping("/boundary/reset")
    fun reset(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @RequestBody request: MarketGeometryUseCase.Reset) = ApiResponse.success(geometry.reset(actor(user), marketId, request))
    @PostMapping("/paths")
    fun path(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.PATH, null, request, request.reason))
    @PutMapping("/paths/{id}")
    fun pathPut(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @PathVariable id: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.PATH, id, request, request.reason))
    @DeleteMapping("/paths/{id}")
    fun pathDelete(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @PathVariable id: Long, @RequestParam reason: String) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.PATH, id, null, reason))
    @PostMapping("/entrances")
    fun entrance(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.ENTRANCE, null, request, request.reason))
    @PutMapping("/entrances/{id}")
    fun entrancePut(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @PathVariable id: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.ENTRANCE, id, request, request.reason))
    @DeleteMapping("/entrances/{id}")
    fun entranceDelete(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @PathVariable id: Long, @RequestParam reason: String) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.ENTRANCE, id, null, reason))
    @PostMapping("/road-rules")
    fun rule(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.ROAD_RULE, null, request, request.reason))
    @PutMapping("/road-rules/{id}")
    fun rulePut(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @PathVariable id: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.ROAD_RULE, id, request, request.reason))
    @DeleteMapping("/road-rules/{id}")
    fun ruleDelete(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @PathVariable id: Long, @RequestParam reason: String) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.ROAD_RULE, id, null, reason))
    @PutMapping("/geo")
    fun geo(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @RequestBody request: MarketGeometryUseCase.Edit) =
        ApiResponse.success(geometry.edit(actor(user), marketId, MarketChangeTarget.MARKET_GEO, null, request, request.reason))
    @GetMapping("/needs-review")
    fun review(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long) = ApiResponse.success(geometry.needsReview(actor(user), marketId))
    @PutMapping("/stores/{storeId}/path")
    fun assign(@RequestHeader("X-User-Id") user: Long, @PathVariable marketId: Long, @PathVariable storeId: Long, @RequestBody request: MarketGeometryUseCase.Assignment) =
        ApiResponse.success(geometry.assign(actor(user), marketId, storeId, request))
}

@RestController
@RequestMapping("/internal/markets")
class MarketGeometryInternalController(private val geometry: MarketGeometryUseCase, private val judge: RejudgeMarketUseCase) {
    @PutMapping("/{marketId}/osm")
    fun osm(@PathVariable marketId: Long, @RequestBody request: MarketGeometryUseCase.Osm): ApiResponse<Unit> {
        geometry.ingest(marketId, request); return ApiResponse.success(Unit)
    }
    @PostMapping("/{marketId}/rejudge")
    fun rejudge(@PathVariable marketId: Long) = ApiResponse.success(MarketGeometryUseCase.Rejudge(judge.rejudge(marketId)))
}
