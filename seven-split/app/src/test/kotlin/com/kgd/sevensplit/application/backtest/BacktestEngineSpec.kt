package com.kgd.sevensplit.application.backtest

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeGreaterThan
import kotlinx.coroutines.runBlocking

/**
 * BacktestEngineSpec — TG-05.6 결정론 회귀 테스트.
 *
 * 동일 CSV + 동일 BacktestConfig(seed) 로 2 회 실행 시 이벤트 리스트·체결·PnL·inputHash 가
 * byte-level 로 동일해야 한다. tight / volatile 두 시나리오 커버.
 *
 * Principle: 시드 기반 ID 발급 + bar timestamp 기반 Clock 주입 → 비결정 포인트 제거.
 */
class BacktestEngineSpec : BehaviorSpec({

    Given("tight CSV fixture 와 동일 seed(42) 를 2 회 실행한다") {
        When("StrategyExecutor.run() 결과를 비교한다") {
            Then("events/executions/realizedPnl/inputHash 가 완전히 동일하다") {
                val r1 = runBlocking { BacktestRunner.execute("tight", seed = 42L) }
                val r2 = runBlocking { BacktestRunner.execute("tight", seed = 42L) }

                r1.inputHash shouldBe r2.inputHash
                r1.events shouldBe r2.events
                r1.executions shouldBe r2.executions
                r1.realizedPnl shouldBe r2.realizedPnl
                r1.totalOrders shouldBe r2.totalOrders
                r1.startedAt shouldBe r2.startedAt
                r1.endedAt shouldBe r2.endedAt
            }
        }
        When("tight 시나리오는 1 회차만 진입한다") {
            Then("정확히 1 건의 BUY OrderPlaced 이벤트가 발행된다") {
                val result = runBlocking { BacktestRunner.execute("tight", seed = 42L) }
                val buyPlacements = result.events.filterIsInstance<com.kgd.sevensplit.domain.event.OrderPlaced>()
                    .filter { it.side == com.kgd.sevensplit.domain.order.OrderSide.BUY }
                buyPlacements shouldHaveSize 1
                // tight 시나리오는 TP 에 도달하지 않으므로 체결 SELL 이 0 건
                result.events.filterIsInstance<com.kgd.sevensplit.domain.event.RoundSlotClosed>() shouldHaveSize 0
            }
        }
    }

    Given("volatile CSV fixture 와 동일 seed(99) 를 2 회 실행한다") {
        When("StrategyExecutor.run() 결과를 비교한다") {
            Then("events/executions/realizedPnl/inputHash 가 완전히 동일하다") {
                val r1 = runBlocking { BacktestRunner.execute("volatile", seed = 99L) }
                val r2 = runBlocking { BacktestRunner.execute("volatile", seed = 99L) }

                r1.inputHash shouldBe r2.inputHash
                r1.events shouldBe r2.events
                r1.executions shouldBe r2.executions
                r1.realizedPnl shouldBe r2.realizedPnl
            }
        }
        When("seed 를 다르게 주면") {
            Then("events 의 eventId 가 달라서 두 결과가 불일치한다") {
                val r1 = runBlocking { BacktestRunner.execute("volatile", seed = 1L) }
                val r2 = runBlocking { BacktestRunner.execute("volatile", seed = 2L) }
                // eventId / orderId 가 seed 로부터 다른 난수 스트림으로 생성됨을 반영
                r1.events shouldNotBe r2.events
            }
        }
        When("volatile 시나리오의 주문 수") {
            Then("체결 이벤트가 1 건 이상 발생한다 (smoke)") {
                val result = runBlocking { BacktestRunner.execute("volatile", seed = 99L) }
                result.totalOrders shouldBeGreaterThan 0
            }
        }
    }
})
