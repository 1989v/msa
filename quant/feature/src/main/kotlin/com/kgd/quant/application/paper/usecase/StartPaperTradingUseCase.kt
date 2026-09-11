package com.kgd.quant.application.paper.usecase

import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import java.math.BigDecimal

/**
 * PAPER 모드 전략 실행 시작 (TG-P2-09).
 *
 * 전략의 executionMode 가 PAPER 여야 한다. PaperAccount 가 없으면 default 잔고로 만들고,
 * StrategyRun + TrancheSlot 을 영속화한 뒤 StrategyActivated 를 outbox 에 남긴다.
 */
interface StartPaperTradingUseCase {
    suspend fun execute(command: StartPaperTradingCommand): RunId

    companion object {
        /** Phase 2 default 초기 잔고 — 1000만 KRW. */
        val DEFAULT_INITIAL_BALANCE: BigDecimal = BigDecimal("10000000")
    }
}

/**
 * StartPaperTradingCommand — UseCase 입력 DTO.
 *
 * @param initialBalance null 이면 [StartPaperTradingUseCase.DEFAULT_INITIAL_BALANCE] 사용.
 */
data class StartPaperTradingCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val initialBalance: BigDecimal? = null
)
