package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.application.port.marketdata.Bar
import com.kgd.sevensplit.application.port.marketdata.BarInterval
import com.kgd.sevensplit.application.port.marketdata.HistoricalMarketDataSource
import com.kgd.sevensplit.application.port.marketdata.Symbol
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.event.EventPublisher
import com.kgd.sevensplit.domain.slot.RoundSlot
import com.kgd.sevensplit.domain.strategy.EndReason
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.StrategyRun
import com.kgd.sevensplit.domain.strategy.StrategyRunStatus
import kotlinx.coroutines.flow.toList
import java.math.BigDecimal
import java.security.MessageDigest
import java.time.Instant

/**
 * StrategyExecutor — 백테스트 파이프라인 orchestrator.
 *
 * ## 책임
 * 1. [HistoricalMarketDataSource] 에서 Bar 스트림을 수신.
 * 2. 각 bar 마다 [MutableClock] 을 갱신, [BacktestExchangeAdapter] 의 `lastKnownPrice` 를 주입한 뒤
 *    [StrategyEngineLoop.onBar] 호출.
 * 3. 스트림 종료 시 `StrategyRun` 을 `LIQUIDATING` → `CLOSED` 로 전이하고 [BacktestResult] 를 반환.
 *
 * ## 주입
 * - `exchange` : 반드시 [BacktestExchangeAdapter] (집계를 위해 구체 타입 요구).
 * - `clock`    : [MutableClock] — bar timestamp 주입이 가능해야 함.
 * - `eventPublisher` : [InMemoryEventPublisher] 권장 (결과 DTO 에 이벤트 리스트 포함).
 * - `config`  : [BacktestConfig] — seed, slippage 등.
 *
 * ## 결정론 보장 루틴
 * - `DeterministicIdGenerator(seed)` 로 eventId/orderId 를 시드 기반 발급.
 * - `inputHash` 는 `(csv 해시 대체) symbol + interval + from + to + seed + initialBalance + slippage`
 *   를 SHA-256 으로 축약. 실제 CSV 해시는 Phase 2 에서 file-based 로 확장.
 *
 * ## 한계
 * - Bar 가 0 개인 경우 `startedAt = endedAt = 현재 clock 시각` 으로 채워 결과를 반환.
 */
class StrategyExecutor(
    private val exchange: BacktestExchangeAdapter,
    private val marketData: HistoricalMarketDataSource,
    private val clock: MutableClock,
    private val eventPublisher: InMemoryEventPublisher,
    private val config: BacktestConfig,
    private val tenantId: TenantId
) {

    suspend fun run(
        strategy: SplitStrategy,
        run: StrategyRun,
        slots: MutableList<RoundSlot>,
        symbol: Symbol,
        from: Instant,
        to: Instant,
        interval: BarInterval
    ): BacktestResult {
        require(run.status == StrategyRunStatus.INITIALIZED) {
            "StrategyExecutor.run: StrategyRun must be INITIALIZED but was ${run.status}"
        }

        run.start() // → ACTIVE

        val idGenerator = DeterministicIdGenerator(config.seed)
        val loop = StrategyEngineLoop(
            exchange = exchange,
            clock = clock,
            eventPublisher = eventPublisher,
            idGenerator = idGenerator,
            tenantId = tenantId
        )

        val bars: List<Bar> = marketData.stream(symbol, from, to, interval).toList()
        if (bars.isEmpty()) {
            val ts = clock.now()
            run.beginLiquidation()
            run.end(EndReason.COMPLETED, ts)
            return buildResult(
                run = run,
                strategy = strategy,
                startedAt = ts,
                endedAt = ts,
                symbol = symbol,
                from = from,
                to = to,
                interval = interval
            )
        }

        val startedAt = bars.first().timestamp
        for (bar in bars) {
            clock.advanceTo(bar.timestamp)
            exchange.updateLastPrice(bar.close)
            loop.onBar(strategy, run, slots, bar)
        }
        val endedAt = bars.last().timestamp

        // Run status → LIQUIDATING → CLOSED
        if (run.status == StrategyRunStatus.AWAITING_EXHAUSTED) {
            run.backToActive()
        }
        run.beginLiquidation()
        run.end(EndReason.COMPLETED, endedAt)

        return buildResult(
            run = run,
            strategy = strategy,
            startedAt = startedAt,
            endedAt = endedAt,
            symbol = symbol,
            from = from,
            to = to,
            interval = interval
        )
    }

    private fun buildResult(
        run: StrategyRun,
        strategy: SplitStrategy,
        startedAt: Instant,
        endedAt: Instant,
        symbol: Symbol,
        from: Instant,
        to: Instant,
        interval: BarInterval
    ): BacktestResult {
        val executions = exchange.executions()
        val pnl = StrategyEngineLoop.realizedPnlFromEvents(eventPublisher.events)
        return BacktestResult(
            runId = run.id,
            tenantId = tenantId,
            strategyId = strategy.id,
            seed = config.seed,
            events = eventPublisher.events,
            executions = executions,
            realizedPnl = pnl,
            totalOrders = executions.size,
            startedAt = startedAt,
            endedAt = endedAt,
            inputHash = computeInputHash(symbol, from, to, interval)
        )
    }

    private fun computeInputHash(
        symbol: Symbol,
        from: Instant,
        to: Instant,
        interval: BarInterval
    ): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val payload = buildString {
            append(symbol.value).append('|')
            append(interval.name).append('|')
            append(from).append('|')
            append(to).append('|')
            append(config.seed).append('|')
            append(config.initialBalance.toPlainString()).append('|')
            append(normalizeDecimal(config.slippagePercent))
        }
        val bytes = digest.digest(payload.toByteArray(Charsets.UTF_8))
        return bytes.joinToString(separator = "") { "%02x".format(it) }
    }

    private fun normalizeDecimal(value: BigDecimal): String = value.stripTrailingZeros().toPlainString()
}
