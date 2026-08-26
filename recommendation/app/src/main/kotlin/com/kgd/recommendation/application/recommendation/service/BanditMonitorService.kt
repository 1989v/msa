package com.kgd.recommendation.application.recommendation.service

import com.kgd.recommendation.application.recommendation.port.BanditPort
import com.kgd.recommendation.application.recommendation.port.BanditVariantStats
import com.kgd.recommendation.application.recommendation.usecase.MonitorBanditUseCase
import org.springframework.stereotype.Service

@Service
class BanditMonitorService(
    private val banditPort: BanditPort,
) : MonitorBanditUseCase {

    override fun stats(): List<BanditVariantStats> = banditPort.snapshot()

    override fun recordClick(variant: String) = banditPort.recordClick(variant)

    override fun reset() = banditPort.reset()
}
