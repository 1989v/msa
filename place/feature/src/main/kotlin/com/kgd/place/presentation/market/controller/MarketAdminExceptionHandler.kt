package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.MarketEditConflict
import org.springframework.core.annotation.Order
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@Order(-1)
@RestControllerAdvice(assignableTypes = [MarketGeometryController::class, MarketGeometryInternalController::class, MarketAdminController::class, MarketManageController::class, MarketStewardController::class, MarketStewardAdminController::class])
class MarketAdminExceptionHandler {
    @ExceptionHandler(IllegalArgumentException::class)
    fun invalid(e: IllegalArgumentException): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.badRequest().body(ApiResponse.error("INVALID_INPUT", e.message ?: "Invalid market edit"))
    @ExceptionHandler(com.kgd.place.domain.market.model.InvalidMarketStewardTransition::class)
    fun transition(e: com.kgd.place.domain.market.model.InvalidMarketStewardTransition): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(409).body(ApiResponse.error("CONFLICT", e.message ?: "Invalid steward transition"))
    @ExceptionHandler(MarketEditConflict::class)
    fun conflict(e: MarketEditConflict): ResponseEntity<ApiResponse<Nothing>> =
        ResponseEntity.status(409).body(ApiResponse.error("CONFLICT", e.message ?: "Market edit conflict"))
}
