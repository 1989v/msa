package com.kgd.recommendation.application.recommendation.usecase

import com.kgd.recommendation.application.recommendation.port.BanditVariantStats

/** 밴딧 posterior 조회 + 운영자 수동 보정 (Phase 6). 정상 reward 흐름은 Kafka click consumer. */
interface MonitorBanditUseCase {
    fun stats(): List<BanditVariantStats>
    fun recordClick(variant: String)
    fun reset()
}
