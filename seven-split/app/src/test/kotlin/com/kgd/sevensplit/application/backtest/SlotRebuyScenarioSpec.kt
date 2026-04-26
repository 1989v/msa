package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.domain.event.RoundSlotClosed
import com.kgd.sevensplit.domain.event.RoundSlotOpened
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking

/**
 * SlotRebuyScenarioSpec — TG-05.8 (FR-ENG-05).
 *
 * volatile fixture 는 중간에 반등 → TP 도달로 매도 후 재하락 → 동일 slotId 로 재매수하는 궤적을
 * 포함한다. 본 spec 은 **동일 slotId 에 대해 RoundSlotOpened 이벤트가 2 회 이상 발행** 되고,
 * 각 오픈 사이에 RoundSlotClosed 가 끼어 있음을 검증한다 — 슬롯 재활용 경로 보호.
 */
class SlotRebuyScenarioSpec : BehaviorSpec({

    Given("volatile fixture 를 실행하면") {
        val result = runBlocking { BacktestRunner.execute("volatile", seed = 17L) }
        val opens = result.events.filterIsInstance<RoundSlotOpened>()
        val closes = result.events.filterIsInstance<RoundSlotClosed>()

        When("slotId 별로 open 횟수를 세면") {
            Then("최소 1 개의 slotId 는 2 회 이상 open 된다 (slot 재활용)") {
                val openCountBySlot = opens.groupBy { it.slotId }.mapValues { it.value.size }
                val reusedSlots = openCountBySlot.filterValues { it >= 2 }
                reusedSlots.isNotEmpty() shouldBe true
            }
            Then("재활용된 slot 의 이벤트 순서는 Opened → Closed → Opened 이다") {
                // 동일 slotId 의 이벤트 흐름을 순서대로 필터
                val openCountBySlot = opens.groupBy { it.slotId }.mapValues { it.value.size }
                val reusedSlotId = openCountBySlot.entries.first { it.value >= 2 }.key

                val slotEvents = result.events.filter { event ->
                    when (event) {
                        is RoundSlotOpened -> event.slotId == reusedSlotId
                        is RoundSlotClosed -> event.slotId == reusedSlotId
                        else -> false
                    }
                }
                // 최소 Opened → Closed → Opened 3 이벤트 이상
                slotEvents.size shouldBeGreaterThan 2
                // 첫 이벤트는 Opened, 둘째는 Closed, 셋째는 Opened
                (slotEvents[0] is RoundSlotOpened) shouldBe true
                (slotEvents[1] is RoundSlotClosed) shouldBe true
                (slotEvents[2] is RoundSlotOpened) shouldBe true
            }
            Then("SELL 체결이 최소 1 회 발생한다 (RoundSlotClosed 존재)") {
                // Principle: 재활용은 먼저 매도 체결이 있어야만 가능
                (closes.size shouldBeGreaterThan 0)
            }
            Then("재활용된 slotId 가 closed 이벤트에도 등장한다") {
                val openCountBySlot = opens.groupBy { it.slotId }.mapValues { it.value.size }
                val reusedSlotId = openCountBySlot.entries.first { it.value >= 2 }.key
                closes.map { it.slotId } shouldContain reusedSlotId
            }
        }
    }
})
