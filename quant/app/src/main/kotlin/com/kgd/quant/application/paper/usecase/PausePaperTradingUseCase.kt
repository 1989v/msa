package com.kgd.quant.application.paper.usecase

import com.kgd.quant.application.exception.StrategyNotFoundException
import com.kgd.quant.application.port.persistence.OutboxRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRepositoryPort
import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.event.StrategyPaused
import com.kgd.quant.domain.strategy.StrategyStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

private val logger = KotlinLogging.logger {}

/**
 * PausePaperTradingUseCase — PAPER 모드 전략 일시정지 (TG-P2-09).
 *
 * ## Phase 2 단순화 (TODO)
 * 골격만 — 실제 엔진 루프 일시정지 토글은 long-running coroutine 통합 (TG-P2-13/15) 시 추가.
 * 현재는 TrancheStrategy.status 를 PAUSED 로 전이하고 outbox 이벤트만 발행한다.
 */
@Component
class PausePaperTradingUseCase(
    private val strategyRepository: StrategyRepositoryPort,
    private val outboxRepository: OutboxRepositoryPort
) {

    suspend fun execute(command: PausePaperTradingCommand) {
        val strategy = strategyRepository.findById(command.tenantId, command.strategyId)
            ?: throw StrategyNotFoundException(command.strategyId, command.tenantId)
        check(strategy.executionMode == ExecutionMode.PAPER) {
            "PausePaperTradingUseCase: strategy executionMode must be PAPER but was ${strategy.executionMode}"
        }

        if (strategy.status == StrategyStatus.PAUSED) {
            logger.info { "PausePaperTradingUseCase: already PAUSED strategyId=${strategy.id} — no-op" }
            return
        }

        val event = strategy.pause() // 도메인 메서드 — 상태 전이 + StrategyPaused 반환
        require(event is StrategyPaused) { "PausePaperTradingUseCase: unexpected event type ${event::class.simpleName}" }
        strategyRepository.save(strategy)
        outboxRepository.append(event)

        logger.info { "PAPER trading paused tenantId=${command.tenantId} strategyId=${command.strategyId}" }
    }
}

data class PausePaperTradingCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId
)
