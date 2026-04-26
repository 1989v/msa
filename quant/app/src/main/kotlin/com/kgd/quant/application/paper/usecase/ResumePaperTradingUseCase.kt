package com.kgd.quant.application.paper.usecase

import com.kgd.quant.application.exception.StrategyNotFoundException
import com.kgd.quant.application.port.persistence.OutboxRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRepositoryPort
import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.event.StrategyResumed
import com.kgd.quant.domain.strategy.StrategyStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

private val logger = KotlinLogging.logger {}

/**
 * ResumePaperTradingUseCase — PAPER 모드 전략 재개 (TG-P2-09).
 *
 * Phase 2 단순화: 골격만. 실제 엔진 루프 재개 토글은 TG-P2-13/15 에서 추가.
 */
@Component
class ResumePaperTradingUseCase(
    private val strategyRepository: StrategyRepositoryPort,
    private val outboxRepository: OutboxRepositoryPort
) {

    suspend fun execute(command: ResumePaperTradingCommand) {
        val strategy = strategyRepository.findById(command.tenantId, command.strategyId)
            ?: throw StrategyNotFoundException(command.strategyId, command.tenantId)
        check(strategy.executionMode == ExecutionMode.PAPER) {
            "ResumePaperTradingUseCase: strategy executionMode must be PAPER but was ${strategy.executionMode}"
        }

        if (strategy.status == StrategyStatus.ACTIVE) {
            logger.info { "ResumePaperTradingUseCase: already ACTIVE strategyId=${strategy.id} — no-op" }
            return
        }

        val event = strategy.resume() // PAUSED → ACTIVE + StrategyResumed
        require(event is StrategyResumed) { "ResumePaperTradingUseCase: unexpected event type ${event::class.simpleName}" }
        strategyRepository.save(strategy)
        outboxRepository.append(event)

        logger.info { "PAPER trading resumed tenantId=${command.tenantId} strategyId=${command.strategyId}" }
    }
}

data class ResumePaperTradingCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId
)
