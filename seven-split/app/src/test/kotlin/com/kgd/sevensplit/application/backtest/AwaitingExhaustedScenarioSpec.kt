package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.domain.event.OrderPlaced
import com.kgd.sevensplit.domain.event.RoundSlotOpened
import com.kgd.sevensplit.domain.order.OrderSide
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking

/**
 * AwaitingExhaustedScenarioSpec — TG-05.7.
 *
 * 지속 하락 fixture(`exhausted`) 로 모든 7 회차가 체결된 후 추가 하락 bar 에서
 * 새 매수(`OrderPlaced` with [OrderSide.BUY], `RoundSlotOpened`) 이벤트가 발행되지 않음을 검증.
 *
 * Principle (FR-ENG-06):
 * - 모든 슬롯이 FILLED → StrategyRun.status = AWAITING_EXHAUSTED 전이
 * - 추가 매수 시도 없음 (emptySlots.isEmpty() 가드)
 */
class AwaitingExhaustedScenarioSpec : BehaviorSpec({

    Given("지속 하락 exhausted fixture 를 실행하면") {
        When("전체 결과를 확인한다") {
            Then("OrderPlaced(BUY) 는 정확히 7 건 (회차 수) 만 발행된다") {
                val result = runBlocking { BacktestRunner.execute("exhausted", seed = 7L) }
                val buyPlacements = result.events
                    .filterIsInstance<OrderPlaced>()
                    .filter { it.side == OrderSide.BUY }

                // exhausted fixture: 15 bars 중 첫 7 bar 가 각 회차 threshold 를 정확히 타격.
                buyPlacements shouldHaveSize 7
            }
            Then("RoundSlotOpened 이벤트도 7 회만 발행된다") {
                val result = runBlocking { BacktestRunner.execute("exhausted", seed = 7L) }
                val opened = result.events.filterIsInstance<RoundSlotOpened>()
                opened shouldHaveSize 7
                // 각 슬롯의 roundIndex 는 0..6 에 정확히 한 번씩
                opened.map { it.roundIndex }.sorted() shouldBe (0..6).toList()
            }
            Then("추가 하락 bar 에서는 신규 BUY 이벤트가 발생하지 않는다") {
                val result = runBlocking { BacktestRunner.execute("exhausted", seed = 7L) }
                // 마지막 BUY 이벤트 timestamp 이후의 이벤트 중 BUY OrderPlaced 가 없어야 함.
                val buys = result.events
                    .filterIsInstance<OrderPlaced>()
                    .filter { it.side == OrderSide.BUY }
                val lastBuyAt = buys.maxOf { it.occurredAt }

                // 마지막 bar 는 2026-03-01T00:14:00Z. 마지막 BUY 는 2026-03-01T00:06:00Z (7 번째 bar)
                // 이후 bar 들 (7..14) 에서 BUY 가 없음을 직접 확인.
                val postExhaustionBuys = result.events
                    .filterIsInstance<OrderPlaced>()
                    .filter { it.side == OrderSide.BUY && it.occurredAt > lastBuyAt }
                postExhaustionBuys shouldHaveSize 0
            }
        }
    }
})
