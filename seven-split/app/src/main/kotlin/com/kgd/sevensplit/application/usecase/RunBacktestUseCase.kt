package com.kgd.sevensplit.application.usecase

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.sevensplit.application.backtest.BacktestConfig
import com.kgd.sevensplit.application.backtest.BacktestExchangeAdapter
import com.kgd.sevensplit.application.backtest.BacktestResult
import com.kgd.sevensplit.application.backtest.InMemoryEventPublisher
import com.kgd.sevensplit.application.backtest.MutableClock
import com.kgd.sevensplit.application.backtest.StrategyExecutor
import com.kgd.sevensplit.application.exception.StrategyNotFoundException
import com.kgd.sevensplit.application.port.marketdata.BarInterval
import com.kgd.sevensplit.application.port.marketdata.HistoricalMarketDataSource
import com.kgd.sevensplit.application.port.marketdata.Symbol
import com.kgd.sevensplit.application.port.persistence.BacktestRunRecord
import com.kgd.sevensplit.application.port.persistence.BacktestRunRepositoryPort
import com.kgd.sevensplit.application.port.persistence.OutboxRepositoryPort
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.application.service.StrategyRunPersistenceService
import com.kgd.sevensplit.application.view.BacktestRunResultView
import com.kgd.sevensplit.application.view.EventSummary
import com.kgd.sevensplit.domain.common.Clock
import com.kgd.sevensplit.domain.event.StrategyActivated
import com.kgd.sevensplit.domain.event.StrategyLiquidated
import com.kgd.sevensplit.domain.strategy.EndReason
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.math.BigDecimal

private val logger = KotlinLogging.logger {}

/**
 * RunBacktestUseCase — 백테스트 1 회 실행 오케스트레이터.
 *
 * ## 흐름 (ADR-0020 트랜잭션 경계)
 *  1. 전략 조회 (no txn)
 *  2. `StrategyRunPersistenceService.initializeRun(...)` — StrategyRun + Slot 저장 (짧은 txn)
 *  3. `StrategyActivated` 이벤트를 Outbox 에 append (짧은 txn — persistence service 내부)
 *  4. `StrategyExecutor.run(...)` — 엔진 시뮬레이션 (txn 밖, 길다)
 *  5. `StrategyRunPersistenceService.finalizeRun(...)` — Run 상태 전이 + 저장 (짧은 txn)
 *  6. `StrategyLiquidated(Completed)` 이벤트 Outbox append (짧은 txn)
 *  7. ClickHouse `backtest_run` insert (best-effort, txn 밖)
 *  8. 결과 DTO 반환
 *
 * ## 외부 IO 경계
 * - 엔진 실행·ClickHouse 저장은 DB 트랜잭션 밖.
 * - Outbox append 는 자체 짧은 트랜잭션 (JPA adapter 가 open-in-view 로 처리).
 *
 * ## Phase 1 단순화
 *  - MDD / Sharpe = 0 고정.
 *  - ClickHouse 저장 실패는 경고 로그만 남기고 API 응답에 영향 주지 않음.
 *  - 슬롯 targetQty 는 placeholder (`Quantity.ONE`) — 엔진이 실제 체결가로 pnl 계산.
 *
 * ## 로깅 (ADR-0021)
 * kotlin-logging 람다 형식. error 레벨은 외부 IO 실패 한정.
 */
@Component
class RunBacktestUseCase(
    private val strategyRepository: StrategyRepositoryPort,
    private val persistenceService: StrategyRunPersistenceService,
    private val outboxRepository: OutboxRepositoryPort,
    private val marketData: HistoricalMarketDataSource,
    private val clock: Clock,
    private val objectMapper: ObjectMapper,
    private val backtestRunRepository: BacktestRunRepositoryPort? = null,
    @Value("\${seven-split.backtest.initial-balance:100000000000}")
    private val initialBalanceRaw: String = "100000000000",
    @Value("\${seven-split.backtest.bar-interval:MINUTE_1}")
    private val barIntervalRaw: String = "MINUTE_1"
) {

    suspend fun execute(command: RunBacktestCommand): BacktestRunResultView {
        // 1. 전략 조회
        val strategy = strategyRepository.findById(command.tenantId, command.strategyId)
            ?: throw StrategyNotFoundException(command.strategyId, command.tenantId)

        val seed = command.seed ?: clock.now().toEpochMilli()
        val startedAt = clock.now()

        // 2. Run + Slot 영속화 (짧은 txn)
        val (run, slots) = persistenceService.initializeRun(strategy, startedAt, seed)

        // 3. StrategyActivated 이벤트 outbox append (짧은 txn — adapter 내부)
        outboxRepository.append(
            StrategyActivated(
                tenantId = strategy.tenantId,
                strategyId = strategy.id
            )
        )

        // 4. 엔진 실행 (txn 밖)
        val initialBalance = BigDecimal(initialBalanceRaw)
        val mutableClock = MutableClock(startedAt)
        val exchange = BacktestExchangeAdapter(
            initialBalance = initialBalance,
            clock = mutableClock
        )
        val inMemoryPublisher = InMemoryEventPublisher()
        val executor = StrategyExecutor(
            exchange = exchange,
            marketData = marketData,
            clock = mutableClock,
            eventPublisher = inMemoryPublisher,
            config = BacktestConfig(seed = seed, initialBalance = initialBalance),
            tenantId = command.tenantId
        )
        val interval = runCatching { BarInterval.valueOf(barIntervalRaw) }.getOrDefault(BarInterval.MINUTE_1)
        val result = executor.run(
            strategy = strategy,
            run = run,
            slots = slots,
            symbol = Symbol(strategy.config.targetSymbol),
            from = command.from,
            to = command.to,
            interval = interval
        )

        // 5. Run finalize (짧은 txn). 엔진이 이미 end() 호출했을 수 있음 — service 가 idempotent 처리.
        persistenceService.finalizeRun(run, result.endedAt, EndReason.COMPLETED)

        // 6. StrategyLiquidated(Completed) outbox append
        outboxRepository.append(
            StrategyLiquidated(
                tenantId = strategy.tenantId,
                strategyId = strategy.id,
                reason = EndReason.COMPLETED
            )
        )

        // 7. ClickHouse 저장 (best-effort)
        saveBacktestRecordBestEffort(strategy.config.targetSymbol, seed, command, result)

        // 8. 응답
        return BacktestRunResultView(
            runId = result.runId,
            strategyId = result.strategyId,
            tenantId = result.tenantId,
            realizedPnl = result.realizedPnl,
            fillCount = result.totalOrders.toLong(),
            startedAt = result.startedAt,
            endedAt = result.endedAt,
            events = result.events.map { EventSummary.from(it) }
        )
    }

    private suspend fun saveBacktestRecordBestEffort(
        targetSymbol: String,
        seed: Long,
        command: RunBacktestCommand,
        result: BacktestResult
    ) {
        val repo = backtestRunRepository ?: return
        runCatching {
            val configJson = runCatching {
                objectMapper.writeValueAsString(mapOf("seed" to seed))
            }.getOrDefault("{}")
            repo.save(
                BacktestRunRecord(
                    runId = result.runId,
                    tenantId = result.tenantId,
                    strategyId = result.strategyId,
                    symbol = targetSymbol,
                    configJson = configJson,
                    seed = seed,
                    from = command.from,
                    to = command.to,
                    realizedPnl = result.realizedPnl,
                    mdd = BigDecimal.ZERO,
                    sharpe = BigDecimal.ZERO,
                    fillCount = result.totalOrders.toLong(),
                    startedAt = result.startedAt,
                    endedAt = result.endedAt
                )
            )
        }.onFailure { e ->
            logger.warn { "RunBacktestUseCase: ClickHouse backtest_run save failed runId=${result.runId} msg=${e.message}" }
        }
    }
}
