package com.kgd.quant.application.strategy.usecase

import com.kgd.quant.domain.common.StrategyId

/** 신규 `TrancheStrategy` 생성 — 도메인 팩토리 검증 → 저장 */
interface CreateStrategyUseCase {
    suspend fun execute(command: CreateStrategyCommand): StrategyId
}
