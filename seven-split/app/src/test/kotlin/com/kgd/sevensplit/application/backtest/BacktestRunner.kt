package com.kgd.sevensplit.application.backtest

import com.kgd.sevensplit.application.port.marketdata.Symbol
import com.kgd.sevensplit.domain.common.TenantId
import java.math.BigDecimal

/**
 * BacktestRunner — 테스트 전용 헬퍼.
 *
 * CSV 시나리오명(`tight`/`volatile`/`exhausted`) 와 seed 를 받아 전체 executor 체인을
 * 조립한 뒤 [BacktestResult] 를 반환한다. 테스트 코드 중복을 줄이기 위한 순수 편의 함수.
 *
 * CSV 위치 규칙: `golden/bithumb/{scenario}/BTC_KRW_MINUTE_1.csv` (scenario 가 resourcePrefix 에 포함).
 * 따라서 Symbol 은 `BTC_KRW` 로 고정되고, 파일 이름은 `${symbol.value}_${interval.name}.csv` 가 된다.
 */
object BacktestRunner {

    suspend fun execute(
        scenario: String,
        seed: Long,
        initialBalance: BigDecimal = BacktestFixtures.INITIAL_BALANCE,
        slippagePercent: BigDecimal = BigDecimal.ZERO
    ): BacktestResult {
        val symbol = Symbol("BTC_KRW")

        val config = BacktestConfig(
            seed = seed,
            initialBalance = initialBalance,
            slippagePercent = slippagePercent
        )
        val clock = MutableClock(BacktestFixtures.FROM)
        val exchange = BacktestExchangeAdapter(
            initialBalance = initialBalance,
            clock = clock,
            slippagePercent = slippagePercent
        )
        val marketData = CsvHistoricalMarketDataSource(
            classLoader = BacktestRunner::class.java.classLoader,
            resourcePrefix = "golden/bithumb/$scenario"
        )
        val eventPublisher = InMemoryEventPublisher()

        val strategy = BacktestFixtures.activeStrategy()
        val run = BacktestFixtures.newRun(startedAt = BacktestFixtures.FROM, seed = seed)
        val slots = BacktestFixtures.emptySlots(strategy.config, run.id)

        val executor = StrategyExecutor(
            exchange = exchange,
            marketData = marketData,
            clock = clock,
            eventPublisher = eventPublisher,
            config = config,
            tenantId = TenantId(BacktestFixtures.TENANT)
        )

        return executor.run(
            strategy = strategy,
            run = run,
            slots = slots,
            symbol = symbol,
            from = BacktestFixtures.FROM,
            to = BacktestFixtures.TO,
            interval = BacktestFixtures.INTERVAL
        )
    }
}
