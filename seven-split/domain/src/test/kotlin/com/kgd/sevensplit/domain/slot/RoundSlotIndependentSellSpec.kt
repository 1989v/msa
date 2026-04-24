package com.kgd.sevensplit.domain.slot

import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.fixtures.SplitFixtures
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bigDecimal
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * INV-02 회차 독립 매도:
 *   슬롯 i의 fillSell/evaluateSellTrigger 는 슬롯 i의 entryPrice/takeProfitPercent 에만 의존한다.
 *   동일 run 에 속한 다른 슬롯의 entryPrice 가 어떻게 바뀌어도 슬롯 i의 매도 판정은 불변이어야 한다.
 */
class RoundSlotIndependentSellSpec : BehaviorSpec({

    Given("동일 run 에 두 슬롯 i, j (서로 다른 entryPrice)") {
        When("슬롯 i 의 evaluateSellTrigger 를 평가하면") {
            Then("슬롯 j 의 entryPrice 에 무관하게 슬롯 i 의 entryPrice/tp 만으로 결정된다") {
                // INV-02
                val arbEntryI = Arb.bigDecimal(BigDecimal("10"), BigDecimal("1000"))
                val arbEntryJ = Arb.bigDecimal(BigDecimal("10"), BigDecimal("1000"))
                val arbTp = Arb.bigDecimal(BigDecimal("1"), BigDecimal("30"))
                val arbDelta = Arb.int(-20..20)

                checkAll(25, arbEntryI, arbEntryJ, arbTp, arbDelta) { eI, eJ, tp, deltaPct ->
                    val runId = RunId.newId()
                    val tpPercent = Percent(tp)

                    // slot i 준비: requestBuy → fillBuy → FILLED
                    val slotI = SplitFixtures.newSlot(
                        runId = runId,
                        roundIndex = 0,
                        takeProfitPercent = tpPercent,
                        targetQty = Quantity.of("1")
                    )
                    slotI.requestBuy(Price(eI))
                    slotI.fillBuy(Price(eI), Quantity.of("1"))

                    // slot j 준비: 같은 run 의 다른 entryPrice. slot i 판정에 영향 없어야 함
                    val slotJ = SplitFixtures.newSlot(
                        runId = runId,
                        roundIndex = 1,
                        takeProfitPercent = tpPercent,
                        targetQty = Quantity.of("1")
                    )
                    slotJ.requestBuy(Price(eJ))
                    slotJ.fillBuy(Price(eJ), Quantity.of("1"))

                    // slot i 의 threshold 는 오직 eI 기준
                    val multiplier = BigDecimal.ONE.add(
                        tp.divide(BigDecimal(100), 18, RoundingMode.HALF_UP)
                    )
                    val thresholdI = eI.multiply(multiplier)

                    val currentPriceCandidate = thresholdI.add(
                        BigDecimal(deltaPct)
                    )
                    if (currentPriceCandidate > BigDecimal.ZERO) {
                        val currentPrice = Price(currentPriceCandidate)
                        val expected = currentPriceCandidate.compareTo(thresholdI) >= 0
                        slotI.evaluateSellTrigger(currentPrice) shouldBe expected
                        // slot j 의 entryPrice 가 아무리 달라도 결과는 동일
                    }
                }
            }
        }
    }

    Given("슬롯 i 의 entryPrice 만 변경하고 j 는 고정") {
        When("동일 currentPrice 로 두 슬롯 각각 평가하면") {
            Then("슬롯 i 결과는 i 의 entryPrice 변화에만 반응한다") {
                // INV-02 — 독립성 확인 (cross-slot 영향 없음)
                val runId = RunId.newId()
                val tp = Percent.of("10")
                val slotI = SplitFixtures.newSlot(runId = runId, roundIndex = 0, takeProfitPercent = tp)
                val slotJ = SplitFixtures.newSlot(runId = runId, roundIndex = 1, takeProfitPercent = tp)

                // slot i: entryPrice=100, threshold=110
                slotI.requestBuy(Price.of("100"))
                slotI.fillBuy(Price.of("100"), slotI.targetQty)

                // slot j: entryPrice=200, threshold=220 — 훨씬 높음
                slotJ.requestBuy(Price.of("200"))
                slotJ.fillBuy(Price.of("200"), slotJ.targetQty)

                val current = Price.of("115")
                // current=115 >= i.threshold(110) → true
                slotI.evaluateSellTrigger(current) shouldBe true
                // current=115 < j.threshold(220) → false (슬롯 j 의 entryPrice 만으로 판정)
                slotJ.evaluateSellTrigger(current) shouldBe false
            }
        }
    }
})
