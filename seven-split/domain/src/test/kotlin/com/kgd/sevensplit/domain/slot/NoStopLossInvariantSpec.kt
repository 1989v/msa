package com.kgd.sevensplit.domain.slot

import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.event.DomainEvent
import com.kgd.sevensplit.domain.exception.StopLossAttemptException
import com.kgd.sevensplit.domain.fixtures.SplitFixtures
import io.kotest.assertions.throwables.shouldNotThrow
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bigDecimal
import io.kotest.property.checkAll
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * INV-01 손절 없음:
 *   어떤 경로로도 RoundSlot.fillSell() 이 손실 가격으로 체결될 수 없다.
 *   또한 DomainEvent sealed 계층에 StopLoss 관련 이벤트가 존재하지 않는다.
 */
class NoStopLossInvariantSpec : BehaviorSpec({

    Given("FILLED 상태의 RoundSlot") {
        When("executedPrice 가 (entryPrice × (1 + takeProfit/100)) 미만이면") {
            Then("StopLossAttemptException 이 발생한다") {
                // INV-01
                val arbEntry = Arb.bigDecimal(BigDecimal.ONE, BigDecimal("100000"))
                val arbTp = Arb.bigDecimal(BigDecimal("1"), BigDecimal("50"))
                checkAll(20, arbEntry, arbTp) { entryVal, tpVal ->
                    val entry = Price(entryVal)
                    val tp = Percent(tpVal)

                    // threshold = entryVal * (1 + tp/100), Percent.toMultiplier 와 동일 계산
                    val multiplier = BigDecimal.ONE.add(
                        tpVal.divide(BigDecimal(100), 18, RoundingMode.HALF_UP)
                    )
                    val threshold = entryVal.multiply(multiplier)
                    // threshold 바로 아래 값으로 매도 시도
                    val belowThreshold = threshold.subtract(BigDecimal("0.0001"))

                    // Price 는 양수만 허용하므로 threshold 가 매우 작은 경우 skip
                    if (belowThreshold > BigDecimal.ZERO) {
                        val slot = SplitFixtures.slotReadyToSell(
                            entryPrice = entry,
                            takeProfitPercent = tp,
                            targetQty = Quantity.of("1")
                        )
                        shouldThrow<StopLossAttemptException> {
                            slot.fillSell(Price(belowThreshold))
                        }
                        // 상태는 여전히 PENDING_SELL 유지 (트랜잭션성 보장)
                        slot.state shouldBe RoundSlotState.PENDING_SELL
                    }
                }
            }
        }
        When("executedPrice 가 threshold 이상이면") {
            Then("정상 매도 체결되고 CLOSED 로 전이된다") {
                // INV-01 happy path — threshold 이상 경로만 허용
                val slot = SplitFixtures.slotReadyToSell(
                    entryPrice = Price.of("100"),
                    takeProfitPercent = Percent.of("10")
                )
                // 10% 익절 → threshold = 110
                shouldNotThrow<Throwable> {
                    slot.fillSell(Price.of("110"))
                }
                slot.state shouldBe RoundSlotState.CLOSED
            }
        }
    }

    Given("DomainEvent sealed 계층") {
        Then("StopLoss 관련 이벤트 타입이 존재하지 않는다") {
            // INV-01 — 정적 보장: 도메인 이벤트에 손절 이벤트가 없음
            val allSubclasses = DomainEvent::class.sealedSubclasses
            allSubclasses.none { it.simpleName!!.contains("StopLoss", ignoreCase = true) } shouldBe true
            allSubclasses.none { it.simpleName!!.contains("Loss", ignoreCase = true) } shouldBe true
        }
    }
})
