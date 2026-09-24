package com.kgd.ads.application.settlement

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.application.settlement.usecase.RunSettlementUseCase
import com.kgd.ads.domain.placement.model.FillSource
import com.kgd.ads.infrastructure.metrics.SettlementMetrics
import com.kgd.ads.infrastructure.redis.AdsRedisConnection
import com.kgd.ads.infrastructure.redis.AdsRedisKeys
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.KST
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.NOON_HALF
import com.kgd.ads.support.DecisionClient
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.EventClient
import com.kgd.ads.support.MutableClock
import com.kgd.ads.support.SettlementFixtures
import com.kgd.ads.support.SettlementFixtures.HourlyRow
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import java.time.Clock
import java.time.LocalDateTime
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import javax.sql.DataSource

/**
 * 카운터 → 시간별 집계(실제 MySQL·Redis). 판정 근거는 집계 표·닫힘 기록·정산 기록 행이다.
 * 입력은 이벤트 수락 스크립트와 같은 키에 올린 카운터이고, 첫 시나리오는 결정·이벤트 API 를 거쳐 키 모양까지 잇는다.
 */
@EnabledIf(DockerAvailable::class)
class AggregationIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired runSettlement: RunSettlementUseCase,
    @Autowired refreshIndex: RefreshCandidateIndexUseCase,
    @Autowired adsRedis: AdsRedisConnection,
    @Autowired meterRegistry: MeterRegistry,
    @Autowired @Qualifier("adsClock") clock: Clock,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val counters = SettlementFixtures(jdbc, adsRedis.template)
    val mutableClock = clock as MutableClock
    val port = env.getRequiredProperty("local.server.port").toInt()

    afterSpec { mutableClock.set(NOON_HALF) }

    data class Setup(val advertiserId: Long, val campaignId: Long, val creativeId: Long)

    fun paidSetup(key: String, memberId: Long): Setup {
        fixtures.placement(key)
        val advertiserId = fixtures.memberAdvertiser(memberId)
        val campaignId = fixtures.paidCampaign(advertiserId, listOf(key))
        return Setup(advertiserId, campaignId, fixtures.paidCreative(campaignId, advertiserId))
    }

    fun placementHourly(key: String, hour: LocalDateTime): List<Long>? =
        jdbc.query(
            "SELECT requests, paid_filled, reported_paid, reported_adsense, reported_house, reported_empty " +
                "FROM ad_placement_hourly WHERE placement_key = ? AND hour_kst = ?",
            { rs, _ -> (1..6).map { rs.getLong(it) } },
            key, hour,
        ).singleOrNull()

    fun unregisteredRequests(key: String): Long? =
        jdbc.query("SELECT requests FROM ad_unregistered_placement WHERE placement_key = ?", { rs, _ -> rs.getLong(1) }, key).singleOrNull()

    given("결정·이벤트 API 로 쌓인 카운터") {
        then("집계가 같은 키를 읽어 소재×지면·지면 행을 만들고, 닫힌 시각은 정산된다 — 마지막 집계·정산 시각 메트릭이 오른다") {
            val day = LocalDateTime.of(2026, 10, 2, 12, 30)
            mutableClock.set(day)
            val s = paidSetup("agg-e2e", memberId = 10_001)
            refreshIndex.refresh()
            val token = DecisionClient(port).decide(listOf("agg-e2e"), visitorId = "vid-agg").placement("agg-e2e")["ad"]["impressionToken"].asString()
            EventClient(port).events(listOf(token), visitorId = "vid-agg").accepted shouldBe 1

            val runAt = day.withHour(13).withMinute(20)
            mutableClock.set(runAt)
            val result = runSettlement.run()

            val hour = day.withMinute(0)
            result.closedHours shouldContain hour
            counters.creativeHourly(s.creativeId, "agg-e2e", hour) shouldBe HourlyRow(impressions = 1, clicks = 0, spendMicros = 200, closed = true)
            placementHourly("agg-e2e", hour) shouldBe listOf(1L, 1L, 0L, 0L, 0L, 0L)
            counters.settlements(s.campaignId).getValue(hour).first shouldBe 200L
            counters.walletBalance(s.advertiserId) shouldBe 100_000_000L - 200
            val epoch = runAt.atZone(KST).toEpochSecond().toDouble()
            meterRegistry.get(SettlementMetrics.AGGREGATED_AT).gauge().value() shouldBe epoch
            meterRegistry.get(SettlementMetrics.SETTLED_AT).gauge().value() shouldBe epoch
        }
    }

    given("★ 같은 시각을 여러 번·겹쳐 집계하면") {
        then("집계 값은 언제나 Redis 카운터의 절대값이다 — 더해지지 않는다") {
            val s = paidSetup("agg-upsert", memberId = 10_002)
            val hour = LocalDateTime.of(2026, 10, 5, 10, 0)
            mutableClock.set(hour.withMinute(20))
            counters.creativeCounter(hour, s.creativeId, s.campaignId, s.advertiserId, "agg-upsert", impressions = 3, clicks = 1, spendMicros = 600)
            counters.placementCounter(hour, "agg-upsert", requests = 5, paidFilled = 3, reported = mapOf(FillSource.ADSENSE to 2))
            counters.unregisteredCounter(hour, "agg-unreg-10002", 4)

            runSettlement.run()
            runSettlement.run()
            counters.creativeHourly(s.creativeId, "agg-upsert", hour) shouldBe HourlyRow(3, 1, 600, closed = false)
            placementHourly("agg-upsert", hour) shouldBe listOf(5L, 3L, 0L, 2L, 0L, 0L)

            // 카운터가 더 오른 뒤 두 실행이 겹쳐 돌아도 값은 새 절대값
            counters.creativeCounter(hour, s.creativeId, s.campaignId, s.advertiserId, "agg-upsert", impressions = 2, spendMicros = 400)
            val pool = Executors.newFixedThreadPool(2)
            try {
                pool.invokeAll(List(2) { Callable { runSettlement.run() } }).forEach { it.get() }
            } finally {
                pool.shutdown()
            }
            counters.creativeHourly(s.creativeId, "agg-upsert", hour) shouldBe HourlyRow(5, 1, 1_000, closed = false)
            // 닫히기 전에는 미등록 지면 요청 수를 쓰지 않는다
            unregisteredRequests("agg-unreg-10002") shouldBe null

            // 닫힌 뒤에도 몇 번을 돌려도 같다 — 미등록 요청 수는 닫을 때 한 번만 더해진다
            mutableClock.set(hour.plusHours(1).plusMinutes(15))
            runSettlement.run().closedHours shouldContain hour
            runSettlement.run()
            runSettlement.run()
            counters.creativeHourly(s.creativeId, "agg-upsert", hour) shouldBe HourlyRow(5, 1, 1_000, closed = true)
            placementHourly("agg-upsert", hour) shouldBe listOf(5L, 3L, 0L, 2L, 0L, 0L)
            unregisteredRequests("agg-unreg-10002") shouldBe 4L
        }
    }

    given("★ 덮어쓰기가 실패한 실행") {
        then("그 시각은 닫히지 않고 정산도 정산 완료 시각도 넘어가지 않는다 — 다음 성공한 실행이 닫고 정산한다") {
            val s = paidSetup("agg-fail", memberId = 10_003)
            val hour = LocalDateTime.of(2026, 10, 8, 9, 0)
            counters.creativeCounter(hour, s.creativeId, s.campaignId, s.advertiserId, "agg-fail", impressions = 1, spendMicros = 300)
            // 지면 키 컬럼(64자)을 넘는 필드 — 이 시각의 INSERT 가 실패한다
            val tooLong = "x".repeat(70)
            counters.creativeCounter(hour, s.creativeId, s.campaignId, s.advertiserId, tooLong, impressions = 1)
            mutableClock.set(hour.withHour(10).withMinute(30))

            val failedRun = runSettlement.run()
            failedRun.failedHours shouldContain hour
            failedRun.closedHours shouldNotContain hour
            counters.isHourClosed(hour) shouldBe false
            counters.creativeHourly(s.creativeId, "agg-fail", hour) shouldBe null
            counters.settlements(s.campaignId) shouldBe emptyMap()
            counters.settledThrough(s.advertiserId) shouldBe hour.minusHours(1)

            adsRedis.template.opsForHash<String, String>().delete(
                AdsRedisKeys.creativeHour(hour),
                AdsRedisKeys.creativeFieldPrefix(s.creativeId, s.campaignId, s.advertiserId, tooLong) + ":" + AdsRedisKeys.METRIC_IMPRESSIONS,
            )
            val nextRun = runSettlement.run()
            nextRun.failedHours shouldBe emptyList()
            nextRun.closedHours shouldContain hour
            counters.creativeHourly(s.creativeId, "agg-fail", hour) shouldBe HourlyRow(1, 0, 300, closed = true)
            counters.settlements(s.campaignId).getValue(hour).first shouldBe 300L
            counters.settledThrough(s.advertiserId) shouldBe hour
        }
    }

    given("★ 세 시각 동안 작업이 한 번도 돌지 않은 뒤 한 번 돌면") {
        then("세 시각 모두 반영·닫힘·정산되고 정산 완료 시각이 마지막 시각까지 간다") {
            val s = paidSetup("agg-gap", memberId = 10_004)
            val hours = (10..12).map { LocalDateTime.of(2026, 10, 11, it, 0) }
            hours.forEachIndexed { i, hour ->
                counters.creativeCounter(hour, s.creativeId, s.campaignId, s.advertiserId, "agg-gap", impressions = 1, spendMicros = 100L * (i + 1))
            }
            mutableClock.set(LocalDateTime.of(2026, 10, 11, 13, 15))

            val result = runSettlement.run()

            result.closedHours shouldContainAll hours
            hours.forEachIndexed { i, hour ->
                counters.creativeHourly(s.creativeId, "agg-gap", hour) shouldBe HourlyRow(1, 0, 100L * (i + 1), closed = true)
            }
            counters.settlements(s.campaignId).mapValues { it.value.first } shouldBe hours.zip(listOf(100L, 200L, 300L)).toMap()
            counters.walletBalance(s.advertiserId) shouldBe 100_000_000L - 600
            counters.settledThrough(s.advertiserId) shouldBe hours.last()
        }
    }
})
