package com.kgd.sevensplit.application.usecase

import com.kgd.sevensplit.application.backtest.BacktestFixtures
import com.kgd.sevensplit.application.port.persistence.StrategyRepositoryPort
import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.exception.SplitStrategyConfigInvalidException
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.SplitStrategyConfig
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.runBlocking
import java.math.BigDecimal

/**
 * CreateStrategyUseCase 단위 테스트.
 *
 * - repository.save 가 호출되고 반환된 StrategyId 가 실제 저장된 strategy 의 id 와 일치하는지 확인.
 * - 도메인 config 팩토리가 INV-07 을 검증하므로 UseCase 는 위임만 한다 — 이 경계를 테스트로 못박는다.
 */
class CreateStrategyUseCaseSpec : BehaviorSpec({

    Given("유효한 CreateStrategyCommand") {
        val strategyRepo = mockk<StrategyRepositoryPort>()
        val saved = slot<SplitStrategy>()
        coEvery { strategyRepo.save(capture(saved)) } coAnswers { saved.captured }

        val useCase = CreateStrategyUseCase(strategyRepo)
        val command = CreateStrategyCommand(
            tenantId = TenantId(BacktestFixtures.TENANT),
            config = BacktestFixtures.defaultConfig(),
            executionMode = ExecutionMode.BACKTEST
        )

        When("execute 를 호출하면") {
            val strategyId = runBlocking { useCase.execute(command) }

            Then("repository.save 가 한 번 호출되고 저장된 strategy 의 id 를 반환한다") {
                // Principle: UseCase 는 팩토리 생성 → save 위임만 수행 (CreateStrategyUseCase.kt:23~31)
                coVerify(exactly = 1) { strategyRepo.save(any()) }
                strategyId shouldNotBe null
                strategyId shouldBe saved.captured.id
                saved.captured.tenantId shouldBe TenantId(BacktestFixtures.TENANT)
            }
        }
    }

    Given("roundCount 가 0 인 config") {
        val strategyRepo = mockk<StrategyRepositoryPort>(relaxed = true)
        CreateStrategyUseCase(strategyRepo)  // UseCase 인스턴스는 생성 가능하나 execute 에 도달 전 차단

        When("CreateStrategyCommand 를 만들기 위해 SplitStrategyConfig 를 생성하면") {
            Then("SplitStrategyConfigInvalidException 이 즉시 발생한다 (도메인 팩토리가 차단)") {
                // Principle: INV-07 은 Config 생성자에서 강제 — UseCase 는 위임만, 저장 호출 없음
                shouldThrow<SplitStrategyConfigInvalidException> {
                    SplitStrategyConfig(
                        roundCount = 0,
                        entryGapPercent = Percent.of("-3"),
                        takeProfitPercentPerRound = emptyList(),
                        initialOrderAmount = BigDecimal("100000"),
                        targetSymbol = BacktestFixtures.SYMBOL.value
                    )
                }
                coVerify(exactly = 0) { strategyRepo.save(any()) }
            }
        }
    }
})
