package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.application.port.exchange.ExchangeAdapter
import com.kgd.sevensplit.domain.common.Clock
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.credential.Exchange
import com.kgd.sevensplit.domain.order.Execution
import com.kgd.sevensplit.domain.order.OrderAck
import com.kgd.sevensplit.domain.order.OrderCommand
import com.kgd.sevensplit.domain.order.OrderSide
import com.kgd.sevensplit.domain.order.SpotOrderType
import java.math.BigDecimal
import java.util.UUID

/**
 * BacktestExchangeAdapter — Phase 1 결정론 백테스트용 가상 거래소 어댑터.
 *
 * ## 동작
 * - `placeOrder` 는 현재 bar 의 close (또는 limit 가격) 에 slippage 를 적용해 즉시 체결한다.
 * - 체결 결과를 `orderId` 키로 메모리에 저장하고, 동일 `orderId` 재전송 시 기존 Ack 를 반환해
 *   멱등성을 보장한다 (INV-06).
 * - 가상 잔고는 BUY 시 차감, SELL 시 가산된다. 잔고 부족 시 [InsufficientBalanceException].
 * - `fetchExecution` 은 placeOrder 직후 항상 non-null 을 반환 (즉시 체결 모델).
 * - `cancelOrder` 는 no-op. 백테스트에서는 주문 즉시 체결되므로 취소 대상이 없다.
 *
 * ## 제약
 * - 현물 전용 — margin/future API 호출 없음 (원칙 2, TG-05 Acceptance Criteria).
 * - 단일 스레드 가정. 동시성 제어 없음.
 *
 * ## 사용
 * 엔진 루프가 bar 를 평가하기 전 [updateLastPrice] 로 close 를 주입해야 Market order 체결이 가능하다.
 */
class BacktestExchangeAdapter(
    initialBalance: BigDecimal,
    private val clock: Clock,
    private val slippagePercent: BigDecimal = BigDecimal.ZERO,
    override val exchange: Exchange = Exchange.BITHUMB
) : ExchangeAdapter {

    private var balance: BigDecimal = initialBalance
    private var lastKnownPrice: BigDecimal? = null

    private val acks: MutableMap<UUID, OrderAck> = mutableMapOf()
    private val executionsById: MutableMap<UUID, Execution> = mutableMapOf()
    private val executionsInOrder: MutableList<Execution> = mutableListOf()

    /** 엔진 루프가 bar 갱신 시 호출. Market order 체결 기준가가 된다. */
    fun updateLastPrice(price: BigDecimal) {
        lastKnownPrice = price
    }

    /** 백테스트 결과 집계용 — placeOrder 호출 순서대로의 체결 리스트. */
    fun executions(): List<Execution> = executionsInOrder.toList()

    /** 현재 잔고 (집계용). */
    fun balance(): BigDecimal = balance

    override suspend fun placeOrder(tenantId: TenantId, command: OrderCommand): OrderAck {
        val existing = acks[command.orderId.value]
        if (existing != null) {
            // Idempotent — 동일 orderId 재전송.
            return existing
        }

        val basePrice: BigDecimal = when (val type = command.type) {
            SpotOrderType.Market -> lastKnownPrice
                ?: error("BacktestExchangeAdapter.placeOrder: no lastKnownPrice for Market order")

            is SpotOrderType.Limit -> type.price.value
        }

        val slippageMultiplier: BigDecimal = when (command.side) {
            OrderSide.BUY -> BigDecimal.ONE + slippagePercent.divide(ONE_HUNDRED, SLIPPAGE_SCALE, java.math.RoundingMode.HALF_UP)
            OrderSide.SELL -> BigDecimal.ONE - slippagePercent.divide(ONE_HUNDRED, SLIPPAGE_SCALE, java.math.RoundingMode.HALF_UP)
        }
        val executedPriceValue: BigDecimal = basePrice.multiply(slippageMultiplier)
        val executedPrice = Price(executedPriceValue)

        val notional: BigDecimal = executedPriceValue.multiply(command.quantity.value)
        when (command.side) {
            OrderSide.BUY -> {
                if (balance < notional) {
                    throw InsufficientBalanceException(
                        "BacktestExchangeAdapter: balance=$balance < notional=$notional"
                    )
                }
                balance = balance.subtract(notional)
            }

            OrderSide.SELL -> {
                balance = balance.add(notional)
            }
        }

        val now = clock.now()
        val execution = Execution(
            price = executedPrice,
            quantity = command.quantity,
            executedAt = now
        )
        executionsById[command.orderId.value] = execution
        executionsInOrder.add(execution)

        val ack = OrderAck(
            exchangeOrderId = "bt-${command.orderId.value}",
            acceptedAt = now
        )
        acks[command.orderId.value] = ack
        return ack
    }

    override suspend fun cancelOrder(tenantId: TenantId, exchangeOrderId: String) {
        // 백테스트에서는 즉시 체결되므로 취소 대상이 존재하지 않는다.
    }

    override suspend fun fetchBalance(tenantId: TenantId, symbol: String): BigDecimal = balance

    override suspend fun fetchExecution(tenantId: TenantId, orderId: UUID): Execution? =
        executionsById[orderId]

    companion object {
        private val ONE_HUNDRED = BigDecimal.valueOf(100)
        private const val SLIPPAGE_SCALE = 18
    }
}

/**
 * BacktestExchangeAdapter 잔고 부족 예외.
 *
 * 백테스트 시나리오 설계가 잘못된 경우에만 발생해야 한다 (테스트 픽스처 오류).
 */
class InsufficientBalanceException(message: String) : RuntimeException(message)
