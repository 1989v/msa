package com.kgd.ads.application.settlement

import com.kgd.ads.application.settlement.usecase.RunSettlementUseCase
import com.kgd.ads.infrastructure.redis.AdsRedisConnection
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.NOON_HALF
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.MutableClock
import com.kgd.ads.support.SettlementFixtures
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import java.time.Clock
import java.time.LocalDateTime
import javax.sql.DataSource

/**
 * 닫힌 시각의 정산(실제 MySQL). 입력은 「앞 실행이 닫고 정산 전에 멈춘」 집계 행이고,
 * 판정 근거는 정산 기록·원장 분개·원장 계정 잔액·정산 완료 시각 행이다.
 */
@EnabledIf(DockerAvailable::class)
class SettlementIntegrationSpec(
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired runSettlement: RunSettlementUseCase,
    @Autowired adsRedis: AdsRedisConnection,
    @Autowired @Qualifier("adsClock") clock: Clock,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val rows = SettlementFixtures(jdbc, adsRedis.template)
    val mutableClock = clock as MutableClock

    afterSpec { mutableClock.set(NOON_HALF) }

    data class Setup(val advertiserId: Long, val campaignId: Long, val creativeId: Long, val key: String)

    fun paidSetup(
        key: String,
        memberId: Long,
        balanceMicros: Long = 100_000_000,
        dailyBudgetMicros: Long = 10_000_000,
        totalBudgetMicros: Long? = null,
    ): Setup {
        fixtures.placement(key)
        val advertiserId = fixtures.memberAdvertiser(memberId, balanceMicros = balanceMicros)
        val campaignId = fixtures.paidCampaign(advertiserId, listOf(key), dailyBudgetMicros = dailyBudgetMicros, totalBudgetMicros = totalBudgetMicros)
        return Setup(advertiserId, campaignId, fixtures.paidCreative(campaignId, advertiserId), key)
    }

    fun closed(s: Setup, hour: LocalDateTime, spendMicros: Long) =
        rows.closedHourRow(hour, s.creativeId, s.campaignId, s.advertiserId, s.key, spendMicros)

    fun ledgerTransactionCount(idempotencyKeyPrefix: String): Long =
        jdbc.queryForObject("SELECT COUNT(*) FROM ad_ledger_transaction WHERE idempotency_key LIKE ?", Long::class.java, "$idempotencyKeyPrefix%")!!

    given("★ 닫힌 채 정산되지 않은 세 시각") {
        then("한 번의 실행이 셋 모두 정산하고, 지출 없는 광고주까지 정산 완료 시각이 옮겨진다") {
            val s = paidSetup("stl-catchup", memberId = 10_101)
            val idle = fixtures.memberAdvertiser(10_102)
            val hours = (9..11).map { LocalDateTime.of(2026, 11, 2, it, 0) }
            hours.zip(listOf(100_000L, 200_000L, 300_000L)).forEach { (hour, spend) -> closed(s, hour, spend) }
            val publisherBefore = rows.systemBalance("PUBLISHER_PAYABLE")
            val networkBefore = rows.systemBalance("NETWORK_REVENUE")
            mutableClock.set(LocalDateTime.of(2026, 11, 2, 12, 20))

            val result = runSettlement.run()

            result.settlementFailures shouldBe 0
            rows.settlements(s.campaignId).mapValues { it.value.first } shouldBe hours.zip(listOf(100_000L, 200_000L, 300_000L)).toMap()
            ledgerTransactionCount("SETTLE:${s.campaignId}:") shouldBe 3
            rows.walletBalance(s.advertiserId) shouldBe 100_000_000L - 600_000
            // 배분 68% — 퍼블리셔 408,000 · 수수료 192,000
            (rows.systemBalance("PUBLISHER_PAYABLE") - publisherBefore) shouldBe 408_000L
            (rows.systemBalance("NETWORK_REVENUE") - networkBefore) shouldBe 192_000L
            rows.settledThrough(s.advertiserId) shouldBe hours.last()
            rows.settledThrough(idle) shouldBe hours.last()
        }
    }

    given("★ 정산을 두 번 실행하면") {
        then("잔액과 분개 수가 첫 실행 뒤와 같다 — 같은 캠페인의 두 시각은 각각 한 번씩 청구된다") {
            val s = paidSetup("stl-twice", memberId = 10_103)
            val first = LocalDateTime.of(2026, 11, 5, 9, 0)
            closed(s, first, 150_000)
            closed(s, first.plusHours(1), 250_000)
            mutableClock.set(LocalDateTime.of(2026, 11, 5, 12, 0))

            runSettlement.run()
            val balanceAfterFirst = rows.walletBalance(s.advertiserId)
            val entriesAfterFirst = rows.walletEntries(s.advertiserId)
            balanceAfterFirst shouldBe 100_000_000L - 400_000
            entriesAfterFirst shouldBe (2L to -400_000L)

            runSettlement.run()
            rows.walletBalance(s.advertiserId) shouldBe balanceAfterFirst
            rows.walletEntries(s.advertiserId) shouldBe entriesAfterFirst
            ledgerTransactionCount("SETTLE:${s.campaignId}:") shouldBe 2
        }
    }

    given("한 KST 날의 여러 시각이 일예산을 넘는 지출을 가지면") {
        then("그 날 청구 합은 일예산을 넘지 않고, 청구 0 인 시각은 기록만 있고 원장 거래가 없다 — 다음 날은 새 예산") {
            val s = paidSetup("stl-daily", memberId = 10_104, dailyBudgetMicros = 1_000_000)
            val day = LocalDateTime.of(2026, 11, 8, 9, 0)
            (0..2).forEach { closed(s, day.plusHours(it.toLong()), 600_000) }
            val nextDay = LocalDateTime.of(2026, 11, 9, 0, 0)
            closed(s, nextDay, 600_000)
            mutableClock.set(LocalDateTime.of(2026, 11, 9, 1, 30))

            runSettlement.run()

            val settled = rows.settlements(s.campaignId)
            settled.mapValues { it.value.first } shouldBe mapOf(
                day to 600_000L,
                day.plusHours(1) to 400_000L,
                day.plusHours(2) to 0L,
                nextDay to 600_000L,
            )
            settled.getValue(day.plusHours(2)).second shouldBe null
            ledgerTransactionCount("SETTLE:${s.campaignId}:") shouldBe 3
            rows.walletBalance(s.advertiserId) shouldBe 100_000_000L - 1_600_000
        }
        then("총예산·지갑 잔액도 청구를 자른다 — 지갑은 0 에서 멈춘다") {
            val total = paidSetup("stl-total", memberId = 10_105, totalBudgetMicros = 700_000)
            val poor = paidSetup("stl-wallet", memberId = 10_106, balanceMicros = 300_000)
            val hour = LocalDateTime.of(2026, 11, 12, 9, 0)
            closed(total, hour, 500_000)
            closed(total, hour.plusHours(1), 500_000)
            closed(poor, hour, 500_000)
            closed(poor, hour.plusHours(1), 500_000)
            mutableClock.set(LocalDateTime.of(2026, 11, 12, 12, 0))

            runSettlement.run()

            rows.settlements(total.campaignId).mapValues { it.value.first } shouldBe mapOf(hour to 500_000L, hour.plusHours(1) to 200_000L)
            rows.settlements(poor.campaignId).mapValues { it.value.first } shouldBe mapOf(hour to 300_000L, hour.plusHours(1) to 0L)
            rows.walletBalance(poor.advertiserId) shouldBe 0L
        }
    }

    given("HOUSE 캠페인의 집계 행") {
        then("정산하지 않는다 — 정산 기록도 원장 거래도 없다") {
            val (houseAdvertiser, houseCampaign) = jdbc.queryForObject(
                "SELECT a.id, c.id FROM ad_campaign c JOIN ad_advertiser a ON a.id = c.advertiser_id WHERE a.kind = 'SYSTEM' ORDER BY c.id LIMIT 1",
            ) { rs, _ -> rs.getLong(1) to rs.getLong(2) }!!
            val hour = LocalDateTime.of(2026, 11, 15, 9, 0)
            rows.closedHourRow(hour, creativeId = 1, campaignId = houseCampaign, advertiserId = houseAdvertiser, placementKey = "game-list-banner", spendMicros = 1_000_000)
            mutableClock.set(LocalDateTime.of(2026, 11, 15, 12, 0))
            try {
                runSettlement.run().settlementFailures shouldBe 0
                rows.settlements(houseCampaign) shouldBe emptyMap()
                ledgerTransactionCount("SETTLE:$houseCampaign:") shouldBe 0
                rows.settledThrough(houseAdvertiser) shouldBe null
            } finally {
                jdbc.update("DELETE FROM ad_creative_hourly WHERE campaign_id = ? AND hour_kst = ?", houseCampaign, hour)
            }
        }
    }

    given("한 캠페인의 정산이 실패하면") {
        then("그 광고주의 정산 완료 시각은 실패한 시각 앞에 머물고, 다른 광고주는 나아간다") {
            val broken = paidSetup("stl-broken", memberId = 10_107)
            val healthy = paidSetup("stl-healthy", memberId = 10_108)
            val hour = LocalDateTime.of(2026, 11, 18, 9, 0)
            // 일예산이 없는 유료 캠페인 — 손으로 고친 데이터처럼 정산이 성립하지 않는다
            jdbc.update("UPDATE ad_campaign SET daily_budget_micros = NULL WHERE id = ?", broken.campaignId)
            closed(broken, hour, 100_000)
            closed(healthy, hour, 100_000)
            mutableClock.set(LocalDateTime.of(2026, 11, 18, 12, 0))
            try {
                val result = runSettlement.run()

                result.settlementFailures shouldBe 1
                rows.settlements(broken.campaignId) shouldBe emptyMap()
                rows.settledThrough(broken.advertiserId) shouldBe hour.minusHours(1)
                rows.settlements(healthy.campaignId).getValue(hour).first shouldBe 100_000L
                rows.settledThrough(healthy.advertiserId) shouldBe LocalDateTime.of(2026, 11, 18, 10, 0)
            } finally {
                jdbc.update("DELETE FROM ad_creative_hourly WHERE campaign_id = ?", broken.campaignId)
            }
        }
    }
})
