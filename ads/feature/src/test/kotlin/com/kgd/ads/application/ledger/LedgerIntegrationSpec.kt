package com.kgd.ads.application.ledger

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.kgd.ads.application.ledger.service.LedgerCheckService
import com.kgd.ads.application.ledger.usecase.CheckLedgerUseCase
import com.kgd.ads.application.ledger.usecase.TopUpUseCase
import com.kgd.ads.application.settlement.usecase.RunSettlementUseCase
import com.kgd.ads.infrastructure.metrics.SettlementMetrics
import com.kgd.ads.infrastructure.redis.AdsRedisConnection
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.NOON_HALF
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.MutableClock
import com.kgd.ads.support.SettlementFixtures
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.MeterRegistry
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import java.time.Clock
import java.time.LocalDateTime
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import javax.sql.DataSource

/**
 * 원장 — 셀프 충전 한도, 정산과 충전의 동시 실행, 분개 합 검사(실제 MySQL).
 * 판정 근거는 원장 거래·분개 행과 원장 계정 잔액이다. 지갑은 0 에서 시작해 충전으로만 채운다 —
 * 그래야 「잔액 = 지갑 분개 합」이 성립한다.
 */
@EnabledIf(DockerAvailable::class)
class LedgerIntegrationSpec(
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired topUp: TopUpUseCase,
    @Autowired runSettlement: RunSettlementUseCase,
    @Autowired checkLedger: CheckLedgerUseCase,
    @Autowired adsRedis: AdsRedisConnection,
    @Autowired meterRegistry: MeterRegistry,
    @Autowired @Qualifier("adsClock") clock: Clock,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val rows = SettlementFixtures(jdbc, adsRedis.template)
    val mutableClock = clock as MutableClock

    afterSpec { mutableClock.set(NOON_HALF) }

    fun topUpCount(advertiserId: Long): Long =
        jdbc.queryForObject(
            "SELECT COUNT(DISTINCT e.transaction_id) FROM ad_ledger_entry e JOIN ad_ledger_transaction t ON t.id = e.transaction_id " +
                "WHERE t.type = 'TOPUP' AND e.account_id = ?",
            Long::class.java,
            rows.walletAccountId(advertiserId),
        )!!

    fun transactionsWithKey(key: String): Long =
        jdbc.queryForObject("SELECT COUNT(*) FROM ad_ledger_transaction WHERE idempotency_key = ?", Long::class.java, key)!!

    given("셀프 충전 한도 (1회 100 크레딧 · 하루 500 크레딧)") {
        then("1회 상한을 넘는 충전은 거절되고 원장 행이 없다") {
            val advertiserId = fixtures.memberAdvertiser(10_201, balanceMicros = 0)
            mutableClock.set(LocalDateTime.of(2026, 12, 1, 10, 0))

            shouldThrow<BusinessException> { topUp.execute(TopUpUseCase.Command(10_201, 100_000_001, "led-over-call")) }
            transactionsWithKey("led-over-call") shouldBe 0
            rows.walletBalance(advertiserId) shouldBe 0L
        }
        then("하루 합계가 한도를 넘는 충전은 거절, 다음 날은 다시 된다 — 행위자가 남고 같은 멱등 키는 같은 거래를 돌려준다") {
            val advertiserId = fixtures.memberAdvertiser(10_202, balanceMicros = 0)
            mutableClock.set(LocalDateTime.of(2026, 12, 3, 10, 0))
            val results = (1..5).map { topUp.execute(TopUpUseCase.Command(10_202, 100_000_000, "led-day-$it")) }
            results.last().balanceMicros shouldBe 500_000_000L

            shouldThrow<BusinessException> { topUp.execute(TopUpUseCase.Command(10_202, 1, "led-day-over")) }
            transactionsWithKey("led-day-over") shouldBe 0
            // 한도에 닿은 뒤에도 같은 키의 재요청은 앞 거래 그대로
            topUp.execute(TopUpUseCase.Command(10_202, 100_000_000, "led-day-1")).transactionId shouldBe results.first().transactionId
            topUpCount(advertiserId) shouldBe 5
            jdbc.queryForObject("SELECT actor_member_id FROM ad_ledger_transaction WHERE idempotency_key = 'led-day-1'", Long::class.java) shouldBe 10_202L

            mutableClock.set(LocalDateTime.of(2026, 12, 4, 0, 5))
            topUp.execute(TopUpUseCase.Command(10_202, 100_000_000, "led-next-day")).balanceMicros shouldBe 600_000_000L
        }
    }

    given("★ 정산과 한도 경계의 충전 두 건이 동시에 돌면") {
        then("충전은 하나만 들어가고 거절된 쪽은 원장 행이 없다 — 지갑 잔액 = 지갑 분개 합") {
            val key = "led-race"
            fixtures.placement(key)
            val advertiserId = fixtures.memberAdvertiser(10_203, balanceMicros = 0)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf(key))
            val creativeId = fixtures.paidCreative(campaignId, advertiserId)
            mutableClock.set(LocalDateTime.of(2026, 12, 9, 15, 0))
            topUp.execute(TopUpUseCase.Command(10_203, 100_000_000, "led-race-prev"))
            mutableClock.set(LocalDateTime.of(2026, 12, 10, 10, 0))
            (1..4).forEach { topUp.execute(TopUpUseCase.Command(10_203, 100_000_000, "led-race-$it")) }
            // 오늘 400 크레딧 충전 → 남은 한도 100 크레딧. 60 크레딧 두 건 중 하나만 들어간다
            // 창 안의 빈 시각을 먼저 닫아 둔다 — 경합 중의 실행이 곧바로 정산에 들어가게
            runSettlement.run()
            rows.closedHourRow(LocalDateTime.of(2026, 12, 10, 8, 0), creativeId, campaignId, advertiserId, key, spendMicros = 5_000_000)

            val start = CountDownLatch(1)
            val pool = Executors.newFixedThreadPool(3)
            val futures = try {
                listOf(
                    Callable { start.await(); runCatching { runSettlement.run() } },
                    Callable { start.await(); runCatching { topUp.execute(TopUpUseCase.Command(10_203, 60_000_000, "led-race-a")) } },
                    Callable { start.await(); runCatching { topUp.execute(TopUpUseCase.Command(10_203, 60_000_000, "led-race-b")) } },
                ).map { pool.submit(it) }
                    .also { start.countDown() }
                    .map { it.get() }
            } finally {
                pool.shutdown()
            }

            (futures[0].getOrThrow() as RunSettlementUseCase.Result).settlementFailures shouldBe 0
            val topUps = futures.drop(1)
            topUps.filter { it.isSuccess } shouldHaveSize 1
            (topUps.single { it.isFailure }.exceptionOrNull() is BusinessException) shouldBe true
            (transactionsWithKey("led-race-a") + transactionsWithKey("led-race-b")) shouldBe 1

            rows.settlements(campaignId).values.single().first shouldBe 5_000_000L
            val (_, entrySum) = rows.walletEntries(advertiserId)
            rows.walletBalance(advertiserId) shouldBe entrySum
            entrySum shouldBe 100_000_000L + 400_000_000 + 60_000_000 - 5_000_000
            topUpCount(advertiserId) shouldBe 6
        }
    }

    given("분개 합이 0 이 아닌 원장") {
        then("검사기가 ERROR 로그와 메트릭으로 알린다 — 균형이 돌아오면 0") {
            val appender = ListAppender<ILoggingEvent>().apply { start() }
            val logger = LoggerFactory.getLogger(LedgerCheckService::class.java) as Logger
            logger.addAppender(appender)
            val gauge = { meterRegistry.get(SettlementMetrics.LEDGER_IMBALANCE).gauge().value() }
            try {
                checkLedger.check().imbalanceMicros shouldBe 0L
                gauge() shouldBe 0.0

                val account = rows.walletAccountId(fixtures.memberAdvertiser(10_204, balanceMicros = 0))
                jdbc.update(
                    "INSERT INTO ad_ledger_entry (transaction_id, account_id, amount_micros, created_at) VALUES (0, ?, 777, ?)",
                    account, LocalDateTime.of(2026, 12, 20, 0, 0),
                )
                try {
                    val result = checkLedger.check()
                    result.imbalanceMicros shouldBe 777L
                    result.balanced shouldBe false
                    gauge() shouldBe 777.0
                    appender.list.count { it.level == Level.ERROR && "777" in it.formattedMessage } shouldBe 1
                } finally {
                    jdbc.update("DELETE FROM ad_ledger_entry WHERE account_id = ? AND amount_micros = 777", account)
                }
                checkLedger.check().balanced shouldBe true
                gauge() shouldBe 0.0
            } finally {
                logger.detachAppender(appender)
            }
        }
    }
})
