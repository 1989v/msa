package com.kgd.sevensplit.application.usecase

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.sevensplit.application.backtest.BacktestFixtures
import com.kgd.sevensplit.application.exception.StrategyNotFoundException
import com.kgd.sevensplit.application.port.marketdata.Bar
import com.kgd.sevensplit.application.port.marketdata.BarInterval
import com.kgd.sevensplit.application.port.marketdata.HistoricalMarketDataSource
import com.kgd.sevensplit.application.port.marketdata.Symbol
import com.kgd.sevensplit.application.port.persistence.BacktestRunRepositoryPort
import com.kgd.sevensplit.application.port.persistence.OutboxRepositoryPort
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.application.service.StrategyRunPersistenceService
import com.kgd.sevensplit.domain.common.Clock
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.event.DomainEvent
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.runBlocking
import java.time.Instant

/**
 * RunBacktestUseCase 단위 테스트.
 *
 * - 정상 흐름: 빈 market data 로도 Executor 가 INITIALIZED → CLOSED 로 전이하고 결과 View 를 반환.
 * - 전략 누락: StrategyNotFoundException 이 먼저 발생해 persistenceService 가 호출되지 않아야 함.
 *
 * HistoricalMarketDataSource 를 mock 으로 주입해 외부 데이터 IO 를 제거한다.
 */
class RunBacktestUseCaseSpec : BehaviorSpec({

    fun newUseCase(
        strategyRepo: StrategyRepositoryPort,
        persistenceService: StrategyRunPersistenceService,
        outboxRepo: OutboxRepositoryPort,
        marketData: HistoricalMarketDataSource,
        clock: Clock,
        backtestRunRepo: BacktestRunRepositoryPort? = null
    ): RunBacktestUseCase = RunBacktestUseCase(
        strategyRepository = strategyRepo,
        persistenceService = persistenceService,
        outboxRepository = outboxRepo,
        marketData = marketData,
        clock = clock,
        objectMapper = ObjectMapper(),
        backtestRunRepository = backtestRunRepo
    )

    Given("전략이 존재하고 market data 가 비어 있음") {
        val tenantId = TenantId(BacktestFixtures.TENANT)
        val strategy = BacktestFixtures.activeStrategy()

        val strategyRepo = mockk<StrategyRepositoryPort>()
        coEvery { strategyRepo.findById(tenantId, strategy.id) } returns strategy

        val fixedNow = Instant.parse("2026-04-24T00:00:00Z")
        val clock = Clock { fixedNow }

        // initializeRun 이 실제 도메인 run + slot 을 만들어 반환 (INITIALIZED 상태 보장)
        val persistenceService = mockk<StrategyRunPersistenceService>()
        val runOut = BacktestFixtures.newRun(startedAt = fixedNow, seed = 42L)
        val slotsOut = BacktestFixtures.emptySlots(strategy.config, runOut.id)
        coEvery {
            persistenceService.initializeRun(strategy, fixedNow, 42L)
        } returns (runOut to slotsOut)
        coEvery { persistenceService.finalizeRun(any(), any(), any()) } just Runs

        val outboxRepo = mockk<OutboxRepositoryPort>()
        coEvery { outboxRepo.append(any<DomainEvent>()) } just Runs

        val marketData = mockk<HistoricalMarketDataSource>()
        every {
            marketData.stream(any<Symbol>(), any<Instant>(), any<Instant>(), any<BarInterval>())
        } returns emptyFlow()

        val useCase = newUseCase(strategyRepo, persistenceService, outboxRepo, marketData, clock)
        val command = RunBacktestCommand(
            tenantId = tenantId,
            strategyId = strategy.id,
            from = Instant.parse("2026-04-01T00:00:00Z"),
            to = Instant.parse("2026-04-02T00:00:00Z"),
            seed = 42L
        )

        When("execute 를 호출하면") {
            val result = runBlocking { useCase.execute(command) }

            Then("결과 View 가 반환되고 StrategyNotFoundException 은 발생하지 않는다") {
                // Principle: RunBacktestUseCase.kt:72~144 — 조회→initialize→executor.run→finalize→outbox append 플로우
                result.strategyId shouldBe strategy.id
                result.tenantId shouldBe tenantId
                result.runId shouldBe runOut.id
                coVerify(exactly = 1) { persistenceService.initializeRun(strategy, fixedNow, 42L) }
                coVerify(exactly = 1) { persistenceService.finalizeRun(any(), any(), any()) }
                // StrategyActivated + StrategyLiquidated(Completed) 두 건의 outbox append
                coVerify(exactly = 2) { outboxRepo.append(any()) }
            }
        }
    }

    Given("전략이 존재하지 않음") {
        val tenantId = TenantId(BacktestFixtures.TENANT)
        val missingId = StrategyId.newId()

        val strategyRepo = mockk<StrategyRepositoryPort>()
        coEvery { strategyRepo.findById(tenantId, missingId) } returns null

        val persistenceService = mockk<StrategyRunPersistenceService>()
        val outboxRepo = mockk<OutboxRepositoryPort>()
        val marketData = mockk<HistoricalMarketDataSource>()
        val clock = Clock { Instant.parse("2026-04-24T00:00:00Z") }

        val useCase = newUseCase(strategyRepo, persistenceService, outboxRepo, marketData, clock)
        val command = RunBacktestCommand(
            tenantId = tenantId,
            strategyId = missingId,
            from = Instant.parse("2026-04-01T00:00:00Z"),
            to = Instant.parse("2026-04-02T00:00:00Z"),
            seed = null
        )

        When("execute 를 호출하면") {
            Then("StrategyNotFoundException 이 발생하고 초기화/outbox 호출은 없다") {
                // Principle: RunBacktestUseCase.kt:74~75 — findById 가 null 이면 즉시 실패
                val thrown = shouldThrow<StrategyNotFoundException> {
                    runBlocking { useCase.execute(command) }
                }
                thrown.strategyId shouldBe missingId
                thrown.tenantId shouldBe tenantId
                coVerify(exactly = 0) { persistenceService.initializeRun(any(), any(), any()) }
                coVerify(exactly = 0) { outboxRepo.append(any()) }
            }
        }
    }
})
