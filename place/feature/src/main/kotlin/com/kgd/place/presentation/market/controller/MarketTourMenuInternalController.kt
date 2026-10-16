package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.MarketTourMenuUseCase
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/internal/markets")
class MarketTourMenuInternalController(private val menus: MarketTourMenuUseCase) {
    @PostMapping("/tour-menus")
    fun all(): ApiResponse<MarketTourMenuUseCase.Summary> = ApiResponse.success(menus.attachAll())
    @PostMapping("/{id}/tour-menus")
    fun one(@PathVariable id: Long): ApiResponse<MarketTourMenuUseCase.Summary> = ApiResponse.success(menus.attach(id))
}
