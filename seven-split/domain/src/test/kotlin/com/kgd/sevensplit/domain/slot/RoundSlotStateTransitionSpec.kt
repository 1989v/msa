package com.kgd.sevensplit.domain.slot

import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.exception.IllegalSlotTransitionException
import com.kgd.sevensplit.domain.fixtures.SplitFixtures
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * RoundSlot 상태머신 가드 검증.
 *
 * 허용된 전이: EMPTY → PENDING_BUY → FILLED → PENDING_SELL → CLOSED → EMPTY.
 * 그 외 모든 직접 전이는 IllegalSlotTransitionException.
 */
class RoundSlotStateTransitionSpec : BehaviorSpec({

    Given("EMPTY 슬롯") {
        When("fillBuy 를 먼저 호출하면") {
            Then("IllegalSlotTransitionException 이 발생한다") {
                // Principle: 상태 전이 가드
                val slot = SplitFixtures.newSlot()
                slot.state shouldBe RoundSlotState.EMPTY
                shouldThrow<IllegalSlotTransitionException> {
                    slot.fillBuy(Price.of("100"), Quantity.of("1"))
                }
            }
        }
        When("requestSell 을 호출하면") {
            Then("IllegalSlotTransitionException 이 발생한다") {
                val slot = SplitFixtures.newSlot()
                shouldThrow<IllegalSlotTransitionException> { slot.requestSell() }
            }
        }
    }

    Given("정상 경로 EMPTY → PENDING_BUY → FILLED → PENDING_SELL → CLOSED → EMPTY") {
        When("순차적으로 전이하면") {
            Then("모든 전이가 성공한다") {
                // Principle: 허용된 전이 path 성공
                val slot = SplitFixtures.newSlot(takeProfitPercent = Percent.of("10"))

                slot.requestBuy(Price.of("100"))
                slot.state shouldBe RoundSlotState.PENDING_BUY

                slot.fillBuy(Price.of("100"), slot.targetQty)
                slot.state shouldBe RoundSlotState.FILLED

                slot.requestSell()
                slot.state shouldBe RoundSlotState.PENDING_SELL

                slot.fillSell(Price.of("110"))
                slot.state shouldBe RoundSlotState.CLOSED

                slot.release()
                slot.state shouldBe RoundSlotState.EMPTY
                slot.entryPrice shouldBe null
                slot.filledQty shouldBe Quantity.ZERO
            }
        }
    }

    Given("FILLED 슬롯") {
        When("requestBuy 를 재호출하면") {
            Then("IllegalSlotTransitionException 이 발생한다") {
                // Principle: 중복 매수 금지
                val slot = SplitFixtures.newSlot()
                slot.requestBuy(Price.of("100"))
                slot.fillBuy(Price.of("100"), slot.targetQty)
                shouldThrow<IllegalSlotTransitionException> {
                    slot.requestBuy(Price.of("90"))
                }
            }
        }
    }

    Given("PENDING_SELL 슬롯에서 cancelSell 호출") {
        When("취소하면") {
            Then("FILLED 로 되돌아간다") {
                // Principle: 매도 주문 취소 → FILLED 복원
                val slot = SplitFixtures.slotReadyToSell()
                slot.state shouldBe RoundSlotState.PENDING_SELL
                slot.cancelSell()
                slot.state shouldBe RoundSlotState.FILLED
            }
        }
    }
})
