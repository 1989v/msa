package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.application.port.exchange.ExchangeAdapter
import com.kgd.sevensplit.application.port.marketdata.Bar
import com.kgd.sevensplit.domain.common.Clock
import com.kgd.sevensplit.domain.common.OrderId
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.event.EventPublisher
import com.kgd.sevensplit.domain.event.OrderFilled
import com.kgd.sevensplit.domain.event.OrderPlaced
import com.kgd.sevensplit.domain.event.RoundSlotClosed
import com.kgd.sevensplit.domain.event.RoundSlotOpened
import com.kgd.sevensplit.domain.order.OrderCommand
import com.kgd.sevensplit.domain.order.OrderSide
import com.kgd.sevensplit.domain.order.SpotOrderType
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.slot.RoundSlotState
import com.kgd.sevensplit.domain.strategy.PriceCondition
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.StrategyRun
import com.kgd.sevensplit.domain.strategy.StrategyRunStatus
import java.math.BigDecimal

/**
 * StrategyEngineLoop — bar 한 건을 입력받아 도메인 상태 전이 + 거래소 호출 + 이벤트 발행을 수행한다.
 *
 * ## 평가 순서 (bar 당 1 회)
 * 1. **매도 트리거** (FR-ENG-04) — `FILLED` 슬롯 중 `evaluateSellTrigger(close)` 가 true 인 것부터
 *    `roundIndex` 오름차순으로 전량 매도. 체결 후 `release()` 로 슬롯을 `EMPTY` 로 복귀.
 * 2. **매수 트리거** (FR-ENG-03) — `EMPTY` 슬롯이 있으면 `strategy.nextRoundEntryCondition(lastFilled)` 로
 *    조건을 얻고 close 가 이를 만족하면 가장 작은 `roundIndex` 의 slot 을 매수. 한 bar 당 **최대 1 매수**.
 * 3. **AWAITING_EXHAUSTED 전이 체크** (FR-ENG-06) — 모든 슬롯이 `FILLED` 이면 run 을 `AWAITING_EXHAUSTED`
 *    로 전이, 해제되면 `ACTIVE` 로 복귀. 전이 메서드는 run 상태에 맞을 때만 호출해 IllegalTransition 을 방지.
 *
 * ## 결정론
 * - 모든 이벤트/OrderAck/Execution 시간은 [Clock.now] (= 현재 bar timestamp) 로 확정됨.
 * - 이벤트 `eventId` 와 `orderId` 는 주입된 [DeterministicIdGenerator] 로 부여.
 *
 * ## 원칙 2 (무레버리지)
 * - 발주 타입은 [SpotOrderType.Market] 만 사용. margin/future API 호출 없음.
 */
class StrategyEngineLoop(
    private val exchange: ExchangeAdapter,
    private val clock: Clock,
    private val eventPublisher: EventPublisher,
    private val idGenerator: DeterministicIdGenerator,
    private val tenantId: TenantId
) {

    suspend fun onBar(
        strategy: SplitStrategy,
        run: StrategyRun,
        slots: MutableList<RoundSlot>,
        bar: Bar
    ) {
        val currentPrice = Price(bar.close)

        // 1. 매도 트리거
        processSellTriggers(slots, currentPrice)

        // 2. 매수 트리거 (한 bar 당 최대 1 회)
        processBuyTrigger(strategy, slots, currentPrice)

        // 3. 전 회차 소진/복귀 체크
        syncAwaitingExhaustedStatus(run, slots)
    }

    private suspend fun processSellTriggers(
        slots: MutableList<RoundSlot>,
        currentPrice: Price
    ) {
        val triggered = slots
            .filter { it.state == RoundSlotState.FILLED && it.evaluateSellTrigger(currentPrice) }
            .sortedBy { it.roundIndex }
            .toList() // snapshot — 이후 상태 변경 중 리스트 순회 안전

        for (slot in triggered) {
            val entryPrice = slot.entryPrice
                ?: error("FILLED slot missing entryPrice: slotId=${slot.id}")
            val qty = slot.filledQty

            slot.requestSell()
            val orderId = OrderId(idGenerator.nextUuid())
            val cmd = OrderCommand(
                orderId = orderId,
                side = OrderSide.SELL,
                type = SpotOrderType.Market,
                quantity = qty,
                price = null
            )
            exchange.placeOrder(tenantId, cmd)
            val exec = exchange.fetchExecution(tenantId, orderId.value)
                ?: error("Execution missing after placeOrder: orderId=$orderId")

            // OrderPlaced, OrderFilled 이벤트 발행 (시계열 순서)
            eventPublisher.publish(
                OrderPlaced(
                    eventId = idGenerator.nextUuid(),
                    occurredAt = clock.now(),
                    tenantId = tenantId,
                    orderId = orderId,
                    slotId = slot.id,
                    side = OrderSide.SELL,
                    type = SpotOrderType.Market,
                    quantity = qty,
                    price = null
                )
            )
            eventPublisher.publish(
                OrderFilled(
                    eventId = idGenerator.nextUuid(),
                    occurredAt = clock.now(),
                    tenantId = tenantId,
                    orderId = orderId,
                    executedPrice = exec.price,
                    executedQty = exec.quantity
                )
            )

            slot.fillSell(exec.price)
            val pnl = exec.price.value
                .subtract(entryPrice.value)
                .multiply(exec.quantity.value)
            slot.release()

            eventPublisher.publish(
                RoundSlotClosed(
                    eventId = idGenerator.nextUuid(),
                    occurredAt = clock.now(),
                    tenantId = tenantId,
                    slotId = slot.id,
                    pnl = pnl
                )
            )
        }
    }

    private suspend fun processBuyTrigger(
        strategy: SplitStrategy,
        slots: MutableList<RoundSlot>,
        currentPrice: Price
    ) {
        val emptySlots = slots.filter { it.state == RoundSlotState.EMPTY }
        if (emptySlots.isEmpty()) return

        val lastFilled = slots
            .filter { it.state == RoundSlotState.FILLED && it.entryPrice != null }
            .maxByOrNull { it.roundIndex }

        val condition = strategy.nextRoundEntryCondition(lastFilled)
        val shouldBuy = when (condition) {
            PriceCondition.Immediate -> lastFilled == null // 최초 진입만
            is PriceCondition.AtOrBelow -> currentPrice <= condition.threshold
        }
        if (!shouldBuy) return

        val targetSlot = emptySlots.minByOrNull { it.roundIndex } ?: return

        targetSlot.requestBuy(currentPrice)
        val orderId = OrderId(idGenerator.nextUuid())
        val cmd = OrderCommand(
            orderId = orderId,
            side = OrderSide.BUY,
            type = SpotOrderType.Market,
            quantity = targetSlot.targetQty,
            price = null
        )
        exchange.placeOrder(tenantId, cmd)
        val exec = exchange.fetchExecution(tenantId, orderId.value)
            ?: error("Execution missing after placeOrder: orderId=$orderId")

        eventPublisher.publish(
            OrderPlaced(
                eventId = idGenerator.nextUuid(),
                occurredAt = clock.now(),
                tenantId = tenantId,
                orderId = orderId,
                slotId = targetSlot.id,
                side = OrderSide.BUY,
                type = SpotOrderType.Market,
                quantity = targetSlot.targetQty,
                price = null
            )
        )
        eventPublisher.publish(
            OrderFilled(
                eventId = idGenerator.nextUuid(),
                occurredAt = clock.now(),
                tenantId = tenantId,
                orderId = orderId,
                executedPrice = exec.price,
                executedQty = exec.quantity
            )
        )

        targetSlot.fillBuy(exec.price, exec.quantity)

        eventPublisher.publish(
            RoundSlotOpened(
                eventId = idGenerator.nextUuid(),
                occurredAt = clock.now(),
                tenantId = tenantId,
                slotId = targetSlot.id,
                roundIndex = targetSlot.roundIndex,
                entryPrice = exec.price
            )
        )
    }

    private fun syncAwaitingExhaustedStatus(
        run: StrategyRun,
        slots: MutableList<RoundSlot>
    ) {
        val allFilled = slots.all { it.state == RoundSlotState.FILLED }
        when {
            allFilled && run.status == StrategyRunStatus.ACTIVE -> run.enterAwaitingExhausted()
            !allFilled && run.status == StrategyRunStatus.AWAITING_EXHAUSTED -> run.backToActive()
            else -> { /* no-op */ }
        }
    }

    companion object {
        /** 실현 손익 합산 유틸 — executions 순서대로 BUY/SELL notional 누적. */
        fun realizedPnlFromEvents(events: List<com.kgd.sevensplit.domain.event.DomainEvent>): BigDecimal {
            var pnl = BigDecimal.ZERO
            for (e in events) {
                if (e is RoundSlotClosed) {
                    pnl = pnl.add(e.pnl)
                }
            }
            return pnl
        }
    }
}
