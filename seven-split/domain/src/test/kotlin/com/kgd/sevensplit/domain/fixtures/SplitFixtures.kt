package com.kgd.sevensplit.domain.fixtures

import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Price
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.SplitStrategyConfig
import com.kgd.sevensplit.domain.strategy.StrategyRun
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bigDecimal
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.map
import java.math.BigDecimal
import java.time.Instant

/**
 * Test fixtures + Kotest Arb generators for seven-split domain invariant tests.
 *
 * - No shared mutable state — every call produces a fresh aggregate/entity.
 * - Default values satisfy INV-07 so tests only override the field they exercise.
 */
object SplitFixtures {

    // ------------------------------ defaults ------------------------------

    const val DEFAULT_TENANT = "tenant-1"
    const val DEFAULT_SYMBOL = "BTC-KRW"

    fun validConfig(
        roundCount: Int = 7,
        entryGapPercent: Percent = Percent.of("-3"),
        takeProfitPercent: Percent = Percent.of("10"),
        initialOrderAmount: BigDecimal = BigDecimal("100000"),
        targetSymbol: String = DEFAULT_SYMBOL
    ): SplitStrategyConfig = SplitStrategyConfig(
        roundCount = roundCount,
        entryGapPercent = entryGapPercent,
        takeProfitPercentPerRound = List(roundCount) { takeProfitPercent },
        initialOrderAmount = initialOrderAmount,
        targetSymbol = targetSymbol
    )

    fun newStrategy(
        tenantId: String = DEFAULT_TENANT,
        config: SplitStrategyConfig = validConfig(),
        executionMode: ExecutionMode = ExecutionMode.BACKTEST
    ): SplitStrategy = SplitStrategy.create(
        tenantId = TenantId(tenantId),
        config = config,
        executionMode = executionMode
    )

    fun newRun(
        tenantId: String = DEFAULT_TENANT,
        strategyId: StrategyId = StrategyId.newId(),
        executionMode: ExecutionMode = ExecutionMode.BACKTEST,
        seed: Long = 42L,
        startedAt: Instant = Instant.parse("2026-04-24T00:00:00Z")
    ): StrategyRun = StrategyRun.create(
        strategyId = strategyId,
        tenantId = TenantId(tenantId),
        startedAt = startedAt,
        executionMode = executionMode,
        seed = seed
    )

    fun newSlot(
        runId: RunId = RunId.newId(),
        roundIndex: Int = 0,
        targetQty: Quantity = Quantity.of("1"),
        takeProfitPercent: Percent = Percent.of("10")
    ): RoundSlot = RoundSlot.create(
        id = SlotId.newId(),
        runId = runId,
        roundIndex = roundIndex,
        targetQty = targetQty,
        takeProfitPercent = takeProfitPercent
    )

    /**
     * Drives a fresh slot through requestBuy -> fillBuy -> requestSell so that
     * it is ready for fillSell assertions.
     */
    fun slotReadyToSell(
        entryPrice: Price = Price.of("100"),
        takeProfitPercent: Percent = Percent.of("10"),
        targetQty: Quantity = Quantity.of("1")
    ): RoundSlot {
        val slot = newSlot(takeProfitPercent = takeProfitPercent, targetQty = targetQty)
        slot.requestBuy(entryPrice)
        slot.fillBuy(entryPrice, targetQty)
        slot.requestSell()
        return slot
    }

    // ------------------------------ Arb generators ------------------------------

    /** INV-07: roundCount ∈ [1, 50]. */
    val arbRoundCount: Arb<Int> = Arb.int(
        SplitStrategyConfig.MIN_ROUND..SplitStrategyConfig.MAX_ROUND
    )

    val arbPositivePercent: Arb<Percent> = Arb.bigDecimal(
        min = BigDecimal("0.01"),
        max = BigDecimal("50")
    ).map { Percent(it) }

    val arbNegativePercent: Arb<Percent> = Arb.bigDecimal(
        min = BigDecimal("-50"),
        max = BigDecimal("-0.01")
    ).map { Percent(it) }

    val arbPrice: Arb<Price> = Arb.bigDecimal(
        min = BigDecimal.ONE,
        max = BigDecimal("1000000000")
    ).map { Price(it) }

    val arbQuantity: Arb<Quantity> = Arb.bigDecimal(
        min = BigDecimal("0.00000001"),
        max = BigDecimal("1000")
    ).map { Quantity(it) }

    val arbInitialOrderAmount: Arb<BigDecimal> = Arb.bigDecimal(
        min = BigDecimal("1000"),
        max = BigDecimal("100000000")
    )

    /** Generates a valid SplitStrategyConfig satisfying all INV-07 constraints. */
    val arbValidConfig: Arb<SplitStrategyConfig> = Arb.bind(
        arbRoundCount,
        arbNegativePercent,
        arbPositivePercent,
        arbInitialOrderAmount
    ) { count, gap, tp, amount ->
        SplitStrategyConfig(
            roundCount = count,
            entryGapPercent = gap,
            takeProfitPercentPerRound = List(count) { tp },
            initialOrderAmount = amount,
            targetSymbol = DEFAULT_SYMBOL
        )
    }

    /** List of positive takeProfit percents, length controllable for INV-07 breach cases. */
    fun arbTakeProfitList(size: Int): Arb<List<Percent>> =
        Arb.list(arbPositivePercent, size..size)
}
