package com.kgd.sevensplit.domain.strategy

import com.kgd.sevensplit.domain.event.StrategyActivated
import com.kgd.sevensplit.domain.event.StrategyLiquidated
import com.kgd.sevensplit.domain.event.StrategyPaused
import com.kgd.sevensplit.domain.event.StrategyResumed
import com.kgd.sevensplit.domain.exception.IllegalStrategyTransitionException
import com.kgd.sevensplit.domain.fixtures.SplitFixtures
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

/**
 * SplitStrategy 라이프사이클 상태 전이 BehaviorSpec.
 *
 * 허용: DRAFT -> ACTIVE -> PAUSED -> ACTIVE -> LIQUIDATED -> ARCHIVED
 * 금지: ACTIVE -> ARCHIVED (직접), DRAFT -> LIQUIDATED 등
 */
class StrategyLifecycleSpec : BehaviorSpec({

    Given("DRAFT 상태의 SplitStrategy") {
        When("activate() 호출하면") {
            Then("ACTIVE 로 전이되고 StrategyActivated 이벤트를 발행한다") {
                // Principle: 상태머신은 메서드를 통해서만 전이 (ADR-0022)
                val strategy = SplitFixtures.newStrategy()
                val event = strategy.activate()
                strategy.status shouldBe StrategyStatus.ACTIVE
                event.shouldBeInstanceOf<StrategyActivated>()
                event.tenantId shouldBe strategy.tenantId
            }
        }
        When("pause() 를 먼저 호출하면") {
            Then("IllegalStrategyTransitionException 이 발생한다") {
                // Principle: 허용되지 않은 전이 차단
                val strategy = SplitFixtures.newStrategy()
                shouldThrow<IllegalStrategyTransitionException> { strategy.pause() }
            }
        }
    }

    Given("ACTIVE 전략") {
        When("pause 후 resume 하면") {
            Then("PAUSED -> ACTIVE 로 복원되고 각각의 이벤트를 발행한다") {
                // Principle: ACTIVE ↔ PAUSED 쌍방 전이 허용
                val strategy = SplitFixtures.newStrategy()
                strategy.activate()

                val paused = strategy.pause()
                strategy.status shouldBe StrategyStatus.PAUSED
                paused.shouldBeInstanceOf<StrategyPaused>()

                val resumed = strategy.resume()
                strategy.status shouldBe StrategyStatus.ACTIVE
                resumed.shouldBeInstanceOf<StrategyResumed>()
            }
        }
        When("liquidate(reason) 를 호출하면") {
            Then("LIQUIDATED 로 전이되고 StrategyLiquidated 이벤트를 발행한다") {
                // Principle: 청산은 ACTIVE/PAUSED 에서만 허용
                val strategy = SplitFixtures.newStrategy()
                strategy.activate()
                val event = strategy.liquidate(EndReason.USER_LIQUIDATED)
                strategy.status shouldBe StrategyStatus.LIQUIDATED
                event.shouldBeInstanceOf<StrategyLiquidated>()
                event.reason shouldBe EndReason.USER_LIQUIDATED
            }
        }
    }

    Given("LIQUIDATED 전략") {
        When("activate() 재호출을 시도하면") {
            Then("IllegalStrategyTransitionException 이 발생한다") {
                // Principle: 종료 상태에서 재활성화 금지
                val strategy = SplitFixtures.newStrategy()
                strategy.activate()
                strategy.liquidate(EndReason.COMPLETED)
                shouldThrow<IllegalStrategyTransitionException> { strategy.activate() }
            }
        }
    }
})
