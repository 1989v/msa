package com.kgd.quant.application.strategy.usecase

import com.kgd.quant.application.strategy.port.SignalStrategyRepositoryPort
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.SignalStrategy
import org.springframework.stereotype.Component

@Component
class ListSignalStrategiesQuery(
    private val repo: SignalStrategyRepositoryPort,
) {
    suspend fun execute(tenantId: TenantId): List<SignalStrategy> = repo.findAll(tenantId)
}
