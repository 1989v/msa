package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.backtest.BacktestFixtures
import com.kgd.sevensplit.application.exception.StrategyNotFoundException
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking

/**
 * GetStrategyDetailQuery 단위 테스트.
 *
 * - 존재 시 StrategyDetailView 로 매핑되어 반환되는지 확인.
 * - null → StrategyNotFoundException (404 매핑 경로).
 */
class GetStrategyDetailQuerySpec : BehaviorSpec({

    Given("tenantId 에 해당하는 전략이 존재") {
        val strategyRepo = mockk<StrategyRepositoryPort>()
        val strategy = BacktestFixtures.activeStrategy()
        coEvery {
            strategyRepo.findById(TenantId(BacktestFixtures.TENANT), strategy.id)
        } returns strategy

        val useCase = GetStrategyDetailQuery(strategyRepo)

        When("execute 를 호출하면") {
            val view = runBlocking { useCase.execute(TenantId(BacktestFixtures.TENANT), strategy.id) }

            Then("StrategyDetailView 로 매핑해 반환한다") {
                // Principle: findById → StrategyDetailView.from (GetStrategyDetailQuery.kt:25~29)
                view.strategyId shouldBe strategy.id
                view.tenantId shouldBe strategy.tenantId
                view.status shouldBe strategy.status
                view.config shouldBe strategy.config
            }
        }
    }

    Given("존재하지 않는 strategyId") {
        val strategyRepo = mockk<StrategyRepositoryPort>()
        val tenantId = TenantId(BacktestFixtures.TENANT)
        val missingId = StrategyId.newId()
        coEvery { strategyRepo.findById(tenantId, missingId) } returns null

        val useCase = GetStrategyDetailQuery(strategyRepo)

        When("execute 를 호출하면") {
            Then("StrategyNotFoundException 이 발생한다") {
                // Principle: null → StrategyNotFoundException (INV-05 테넌트 격리 동일 처리)
                val thrown = shouldThrow<StrategyNotFoundException> {
                    runBlocking { useCase.execute(tenantId, missingId) }
                }
                thrown.strategyId shouldBe missingId
                thrown.tenantId shouldBe tenantId
            }
        }
    }
})
