package com.kgd.quant.application.paper.usecase

import com.kgd.quant.application.exception.StrategyNotFoundException
import com.kgd.quant.application.port.persistence.OutboxRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRunRepositoryPort
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.event.StrategyLiquidated
import com.kgd.quant.domain.strategy.EndReason
import com.kgd.quant.domain.strategy.StrategyRunStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

private val logger = KotlinLogging.logger {}

/**
 * StopPaperTradingUseCase — PAPER 모드 전략 실행 정지/청산 (TG-P2-09).
 *
 * ## INV (PAPER EndReason)
 * PAPER 모드의 종료 사유는 `COMPLETED` 가 아니다 (페이퍼는 이론상 무한 실행).
 * 본 UseCase 는 [EndReason.USER_LIQUIDATED] 만 허용하며, 다른 reason 은 사용 측 책임.
 *
 * ## 전이
 * StrategyRun: ACTIVE / AWAITING_EXHAUSTED → LIQUIDATING → CLOSED.
 * 이미 CLOSED 면 idempotent (no-op).
 */
@Component
class StopPaperTradingUseCase(
    private val strategyRepository: StrategyRepositoryPort,
    private val runRepository: StrategyRunRepositoryPort,
    private val outboxRepository: OutboxRepositoryPort,
    private val clock: Clock
) {

    suspend fun execute(command: StopPaperTradingCommand) {
        require(command.reason != EndReason.COMPLETED) {
            "StopPaperTradingUseCase: PAPER mode end reason cannot be COMPLETED — open-ended by design"
        }

        val strategy = strategyRepository.findById(command.tenantId, command.strategyId)
            ?: throw StrategyNotFoundException(command.strategyId, command.tenantId)
        check(strategy.executionMode == ExecutionMode.PAPER) {
            "StopPaperTradingUseCase: strategy executionMode must be PAPER but was ${strategy.executionMode}"
        }

        val run = runRepository.findById(command.tenantId, command.runId)
            ?: error("StrategyRun not found tenantId=${command.tenantId} runId=${command.runId}")

        if (run.status == StrategyRunStatus.CLOSED) {
            logger.info { "StopPaperTradingUseCase: run already closed runId=${run.id} — no-op" }
            return
        }

        val now = clock.now()
        if (run.status == StrategyRunStatus.AWAITING_EXHAUSTED) {
            run.backToActive()
        }
        if (run.status == StrategyRunStatus.ACTIVE) {
            run.beginLiquidation()
        }
        if (run.status == StrategyRunStatus.LIQUIDATING) {
            run.end(command.reason, now)
        }
        runRepository.save(run)

        outboxRepository.append(
            StrategyLiquidated(
                tenantId = command.tenantId,
                strategyId = strategy.id,
                reason = command.reason
            )
        )

        logger.info {
            "PAPER trading stopped tenantId=${command.tenantId} strategyId=${command.strategyId} runId=${run.id} reason=${command.reason}"
        }
    }
}

/**
 * StopPaperTradingCommand — UseCase 입력 DTO.
 *
 * @param reason 기본 USER_LIQUIDATED. COMPLETED 는 require 가드로 차단된다.
 */
data class StopPaperTradingCommand(
    val tenantId: TenantId,
    val strategyId: StrategyId,
    val runId: RunId,
    val reason: EndReason = EndReason.USER_LIQUIDATED
)
