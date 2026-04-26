package com.kgd.quant.application.paper.usecase

import com.kgd.quant.application.exception.StrategyNotFoundException
import com.kgd.quant.application.paper.port.PaperAccountRepositoryPort
import com.kgd.quant.application.port.persistence.OutboxRepositoryPort
import com.kgd.quant.application.port.persistence.TrancheSlotRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRunRepositoryPort
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.Quantity
import com.kgd.quant.domain.common.RunId
import com.kgd.quant.domain.common.SlotId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.event.StrategyActivated
import com.kgd.quant.domain.slot.TrancheSlot
import com.kgd.quant.domain.strategy.StrategyRun
import com.kgd.quant.infrastructure.persistence.entity.PaperAccountEntity
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import java.math.BigDecimal

private val logger = KotlinLogging.logger {}

/**
 * StartPaperTradingUseCase — PAPER 모드 전략 실행 시작 (TG-P2-09).
 *
 * ## 분기
 * - 대상 전략의 [com.kgd.quant.domain.strategy.TrancheStrategy.executionMode] 가 반드시 [ExecutionMode.PAPER] 이어야 한다.
 * - BACKTEST/LIVE 전략은 IllegalStateException — UseCase 호출 자체가 잘못된 라우팅.
 *
 * ## 흐름 (Phase 2 단순화)
 * 1. 전략 조회 + PAPER 모드 검증
 * 2. PaperAccount 초기화 — (tenantId, strategyId, KRW) 가 없으면 default 잔고로 생성
 * 3. StrategyRun + TrancheSlot N 개 영속화 (PAPER 모드)
 * 4. StrategyActivated outbox append
 *
 * ## 백그라운드 실행
 * 실시간 시세 → 엔진 평가 → 가상 체결 통합은 본 단계에서 stub.
 * Phase 2 후속 (TG-P2-13/15 SSE/E2E) 에서 long-running coroutine 으로 통합 예정.
 *
 * ## INV-P2-09
 * PaperAccount.balance 와 ExchangeCredential 의 거래소 잔고는 분리. PaperAccountRepositoryPort 만 사용.
 */
@Component
class StartPaperTradingUseCase(
    private val strategyRepository: StrategyRepositoryPort,
    private val runRepository: StrategyRunRepositoryPort,
    private val slotRepository: TrancheSlotRepositoryPort,
    private val accountRepository: PaperAccountRepositoryPort,
    private val outboxRepository: OutboxRepositoryPort,
    private val clock: Clock
) {

    suspend fun execute(command: StartPaperTradingCommand): RunId {
        // 1. 전략 조회 + PAPER 모드 검증
        val strategy = strategyRepository.findById(command.tenantId, command.strategyId)
            ?: throw StrategyNotFoundException(command.strategyId, command.tenantId)

        check(strategy.executionMode == ExecutionMode.PAPER) {
            "StartPaperTradingUseCase: strategy executionMode must be PAPER but was ${strategy.executionMode} (strategyId=${strategy.id})"
        }

        // 2. PaperAccount 초기화 (없으면 default 잔고 생성)
        val initialBalance = command.initialBalance ?: DEFAULT_INITIAL_BALANCE
        val existing = accountRepository.load(command.tenantId, command.strategyId)
        if (existing == null) {
            val now = clock.now()
            val newAccount = PaperAccountEntity(
                tenantId = command.tenantId.value,
                strategyId = command.strategyId.value,
                baseAsset = PaperAccountRepositoryPort.DEFAULT_BASE_ASSET,
                balance = initialBalance,
                createdAt = now,
                updatedAt = now
            )
            accountRepository.save(newAccount)
            logger.info {
                "PaperAccount created tenantId=${command.tenantId} strategyId=${command.strategyId} balance=$initialBalance"
            }
        }

        // 3. Run + Slot 생성 (PAPER 모드, seed=clock.now)
        val startedAt = clock.now()
        val seed = startedAt.toEpochMilli()
        val run = StrategyRun.create(
            strategyId = strategy.id,
            tenantId = command.tenantId,
            startedAt = startedAt,
            executionMode = ExecutionMode.PAPER,
            seed = seed
        )
        runRepository.save(run)

        for (index in 0 until strategy.config.roundCount) {
            val slot = TrancheSlot.create(
                id = SlotId.newId(),
                runId = run.id,
                roundIndex = index,
                // Phase 2 단순화: targetQty placeholder. Phase 3 에서 정식 명목→수량 계산 예정.
                targetQty = Quantity(BigDecimal.ONE),
                takeProfitPercent = strategy.config.takeProfitPercentAt(index)
            )
            slotRepository.save(slot)
        }

        // 4. StrategyActivated outbox append
        outboxRepository.append(
            StrategyActivated(
                tenantId = command.tenantId,
                strategyId = strategy.id
            )
        )

        logger.info {
            "PAPER trading started tenantId=${command.tenantId} strategyId=${command.strategyId} runId=${run.id} seed=$seed"
        }

        // TODO(TG-P2-13/15): MarketDataHub.asFlow() → StrategyEngineLoop.onTick → PaperExchangeAdapter
        // long-running coroutine 통합. 현재는 Run/Slot/PaperAccount 스캐폴드만 셋업.
        return run.id
    }

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
