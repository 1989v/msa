package com.kgd.quant.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.usecase.ListSignalStrategiesQuery
import com.kgd.quant.application.usecase.RegisterSignalStrategyUseCase
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.presentation.dto.CreateSignalStrategyRequest
import com.kgd.quant.presentation.dto.SignalStrategyResponse
import com.kgd.quant.presentation.dto.asset
import com.kgd.quant.presentation.dto.market
import com.kgd.quant.presentation.dto.toDomain
import com.kgd.quant.presentation.dto.toResponse
import com.kgd.quant.presentation.resolver.TenantHeader
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * SignalStrategyController — `/api/v1/signal-strategies` (ADR-0033 Phase 1).
 *
 * 기존 /api/v1/strategies (Tranche, double-star) 와 path 분리하여 하위 호환 보장.
 */
@RestController
@RequestMapping("/api/v1/signal-strategies")
class SignalStrategyController(
    private val register: RegisterSignalStrategyUseCase,
    private val listQuery: ListSignalStrategiesQuery,
) {
    @PostMapping
    suspend fun create(
        @TenantHeader tenantId: TenantId,
        @RequestBody request: CreateSignalStrategyRequest,
    ): ApiResponse<SignalStrategyResponse> {
        val strategy = register.execute(
            tenantId = tenantId,
            asset = request.asset(),
            market = request.market(),
            entrySignal = request.entrySignal.toDomain(),
            exitSignal = request.exitSignal?.toDomain(),
            sizing = request.sizing.toDomain(),
        )
        return ApiResponse.success(strategy.toResponse())
    }

    @GetMapping
    suspend fun list(
        @TenantHeader tenantId: TenantId,
    ): ApiResponse<List<SignalStrategyResponse>> {
        val strategies = listQuery.execute(tenantId)
        return ApiResponse.success(strategies.map { it.toResponse() })
    }
}
