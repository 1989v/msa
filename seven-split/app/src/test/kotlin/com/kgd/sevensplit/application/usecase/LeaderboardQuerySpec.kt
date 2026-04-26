package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.backtest.BacktestFixtures
import com.kgd.sevensplit.application.port.persistence.BacktestRunRecord
import com.kgd.sevensplit.application.port.persistence.BacktestRunRepositoryPort
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import java.math.BigDecimal
import java.time.Instant

/**
 * LeaderboardQuery 단위 테스트.
 *
 * Phase 1 산식: realizedPnl 절대값 내림차순, limit 개수만큼 반환.
 */
class LeaderboardQuerySpec : BehaviorSpec({

    fun record(
        strategyId: StrategyId,
        pnl: BigDecimal,
        endedAt: Instant = Instant.parse("2026-04-24T00:00:00Z")
    ): BacktestRunRecord = BacktestRunRecord(
        runId = RunId.newId(),
        tenantId = TenantId(BacktestFixtures.TENANT),
        strategyId = strategyId,
        symbol = BacktestFixtures.SYMBOL.value,
        configJson = "{}",
        seed = 1L,
        from = Instant.parse("2026-01-01T00:00:00Z"),
        to = Instant.parse("2026-04-01T00:00:00Z"),
        realizedPnl = pnl,
        mdd = BigDecimal.ZERO,
        sharpe = BigDecimal.ZERO,
        fillCount = 5L,
        startedAt = Instant.parse("2026-01-01T00:00:00Z"),
        endedAt = endedAt
    )

    Given("여러 전략에 걸쳐 완료된 run 들") {
        val tenantId = TenantId(BacktestFixtures.TENANT)

        // Leaderboard 테스트는 서로 다른 전략 id 가 필요하므로 SplitStrategy.create 로 직접 생성
        val strategyA = SplitStrategy.create(
            tenantId = tenantId,
            config = BacktestFixtures.defaultConfig(),
            executionMode = ExecutionMode.BACKTEST,
            id = StrategyId.of("00000000-0000-0000-0000-0000000000aa")
        )
        val strategyB = SplitStrategy.create(
            tenantId = tenantId,
            config = BacktestFixtures.defaultConfig(),
            executionMode = ExecutionMode.BACKTEST,
            id = StrategyId.of("00000000-0000-0000-0000-0000000000bb")
        )

        val strategyRepo = mockk<StrategyRepositoryPort>()
        val runRepo = mockk<BacktestRunRepositoryPort>()

        coEvery { strategyRepo.findAll(tenantId) } returns listOf(strategyA, strategyB)
        coEvery { runRepo.findCompletedByStrategy(tenantId, strategyA.id) } returns listOf(
            record(strategyA.id, BigDecimal("100")),
            record(strategyA.id, BigDecimal("-500")),  // abs=500
            record(strategyA.id, BigDecimal("50"))
        )
        coEvery { runRepo.findCompletedByStrategy(tenantId, strategyB.id) } returns listOf(
            record(strategyB.id, BigDecimal("300")),
            record(strategyB.id, BigDecimal("-1000")), // abs=1000
            record(strategyB.id, BigDecimal("-10"))
        )

        val query = LeaderboardQuery(runRepo, strategyRepo)

        When("limit=3 으로 execute 를 호출하면") {
            val result = runBlocking { query.execute(tenantId, limit = 3) }

            Then("realizedPnl 절대값 상위 3 개만 내림차순으로 반환한다") {
                // Principle: LeaderboardQuery.kt:35 — sortedByDescending { abs } + take(limit)
                result.size shouldBe 3
                result[0].realizedPnl shouldBe BigDecimal("-1000")
                result[1].realizedPnl shouldBe BigDecimal("-500")
                result[2].realizedPnl shouldBe BigDecimal("300")
            }
        }
    }
})
