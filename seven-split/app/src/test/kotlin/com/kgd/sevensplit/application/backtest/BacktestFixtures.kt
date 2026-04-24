package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.application.port.marketdata.BarInterval
import com.kgd.sevensplit.application.port.marketdata.Symbol
import com.kgd.sevensplit.domain.common.ExecutionMode
import com.kgd.sevensplit.domain.common.Percent
import com.kgd.sevensplit.domain.common.Quantity
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.SlotId
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.SplitStrategyConfig
import com.kgd.sevensplit.domain.strategy.StrategyRun
import java.math.BigDecimal
import java.time.Instant

/**
 * BacktestFixtures — TG-05 테스트에서 공용으로 사용하는 전략/슬롯/심볼 fixture.
 *
 * - `StrategyId`/`RunId`/`SlotId` 는 고정된 UUID 를 사용해 로그 재현 가능성을 높인다.
 * - `SplitStrategy` / `StrategyRun` / `RoundSlot` 전부 Repository 복원 factory 를 써서
 *   상태를 직접 지정 (테스트 목적상 DRAFT→ACTIVE 등의 전이 확인은 이 spec 의 관심사가 아님).
 */
object BacktestFixtures {

    const val TENANT = "tenant-bt"
    val SYMBOL = Symbol("BTC_KRW")
    val INTERVAL = BarInterval.MINUTE_1
    val INITIAL_BALANCE: BigDecimal = BigDecimal("100000000000") // 1e11 KRW — 충분히 큼
    val TARGET_QTY: Quantity = Quantity.of("1") // qty=1로 고정 (pnl 계산 쉽게)

    /** 7분할 기본 config — entryGap=-3%, takeProfit=10%. */
    fun defaultConfig(): SplitStrategyConfig = SplitStrategyConfig(
        roundCount = 7,
        entryGapPercent = Percent.of("-3"),
        takeProfitPercentPerRound = List(7) { Percent.of("10") },
        initialOrderAmount = BigDecimal("100000"),
        targetSymbol = SYMBOL.value
    )

    /** 고정 StrategyId — 이벤트 재현을 위해 로그에 기록됨. */
    fun strategyId(): StrategyId =
        StrategyId.of("00000000-0000-0000-0000-000000000001")

    fun runId(): RunId =
        RunId.of("00000000-0000-0000-0000-000000000002")

    /** ACTIVE 상태 전략을 즉시 만들어 반환. (DRAFT → ACTIVE 경로는 이 spec 범위 밖) */
    fun activeStrategy(config: SplitStrategyConfig = defaultConfig()): SplitStrategy {
        val strategy = SplitStrategy.create(
            tenantId = TenantId(TENANT),
            config = config,
            executionMode = ExecutionMode.BACKTEST,
            id = strategyId()
        )
        strategy.activate()
        return strategy
    }

    fun newRun(startedAt: Instant, seed: Long): StrategyRun = StrategyRun.create(
        strategyId = strategyId(),
        tenantId = TenantId(TENANT),
        startedAt = startedAt,
        executionMode = ExecutionMode.BACKTEST,
        seed = seed,
        id = runId()
    )

    /** 주어진 config 에 따라 EMPTY 상태의 slot 리스트 생성. SlotId 는 인덱스 기반 고정 UUID. */
    fun emptySlots(config: SplitStrategyConfig, runId: RunId): MutableList<RoundSlot> {
        val result = mutableListOf<RoundSlot>()
        for (i in 0 until config.roundCount) {
            val slotIdUuid = java.util.UUID.fromString("00000000-0000-0000-0000-00000000a%03d".format(i))
            val slot = RoundSlot.create(
                id = SlotId(slotIdUuid),
                runId = runId,
                roundIndex = i,
                targetQty = TARGET_QTY,
                takeProfitPercent = config.takeProfitPercentAt(i)
            )
            result.add(slot)
        }
        return result
    }

    /** 전체 기간 — 모든 fixture CSV 를 포괄하도록 열어 둠. */
    val FROM: Instant = Instant.parse("2026-01-01T00:00:00Z")
    val TO: Instant = Instant.parse("2026-12-31T23:59:59Z")
}
