package com.kgd.ads.application.report

import com.kgd.ads.application.settlement.dto.CampaignHourSpend
import com.kgd.ads.application.settlement.service.SettlementTransactionalService
import com.kgd.ads.support.AdsApiClient
import com.kgd.ads.support.AdsApiClient.As
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.items
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.longs.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import tools.jackson.databind.JsonNode
import java.time.LocalDate
import java.time.LocalDateTime
import javax.sql.DataSource

/**
 * 리포트 = 시간별 집계·정산·원장의 합. 기대값은 리포트 코드가 아니라 같은 표를 SQL 로 직접 더해 얻는다.
 *
 * 정산은 운영 정산 트랜잭션(`SettlementTransactionalService`)을 이 스펙의 (캠페인, 시각)에만 불러 만든다 —
 * 원장 분개(퍼블리셔 몫)까지 운영 경로로 생긴다. 날짜는 2027-01(다른 스펙의 집계·정산 작업이 닿지 않는 달).
 *
 * - 01-05: 지출 50만 ≤ 일예산 100만 → 청구 = 지출
 * - 01-06: 지출 140만 > 일예산 → 청구 100만, 「예산 초과분 미청구」
 * - 01-07: 닫히지 않은(정산 전) 시각 → 청구액 비움
 *
 * 퍼블리셔 원장 총액 행은 따로 2027-02-10 의 광고주(12101)로 본다 — 지면 몫의 내림이 실제로 원장보다 작아지는 금액으로.
 */
@EnabledIf(DockerAvailable::class)
class ReportIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired settlement: SettlementTransactionalService,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val api = AdsApiClient(env.getRequiredProperty("local.server.port").toInt())
    val member = As(11_301)

    fixtures.placement("a-rep-1")
    fixtures.placement("a-rep-2")
    val advertiserId = fixtures.memberAdvertiser(11_301, balanceMicros = 100_000_000)
    val campaignId = fixtures.paidCampaign(advertiserId, listOf("a-rep-1", "a-rep-2"), dailyBudgetMicros = 1_000_000)
    val c1 = fixtures.paidCreative(campaignId, advertiserId)
    val c2 = fixtures.paidCreative(campaignId, advertiserId)

    fun hour(day: Int, h: Int) = LocalDateTime.of(2027, 1, day, h, 0)

    fun hourly(creativeId: Long, placement: String, at: LocalDateTime, impressions: Long, clicks: Long, spend: Long, closed: Boolean = true) {
        jdbc.update(
            "INSERT INTO ad_creative_hourly (creative_id, placement_key, hour_kst, campaign_id, advertiser_id, impressions, clicks, " +
                "spend_micros, closed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            creativeId, placement, at, campaignId, advertiserId, impressions, clicks, spend, if (closed) at.plusMinutes(70) else null, at.plusMinutes(70),
        )
    }

    fun settle(at: LocalDateTime) {
        val spend = jdbc.queryForObject(
            "SELECT SUM(spend_micros) FROM ad_creative_hourly WHERE campaign_id = ? AND hour_kst = ?", Long::class.java, campaignId, at,
        )!!
        settlement.settle(CampaignHourSpend(campaignId, advertiserId, at, spend), at.plusMinutes(75))
    }

    hourly(c1, "a-rep-1", hour(5, 10), impressions = 100, clicks = 3, spend = 300_000)
    hourly(c2, "a-rep-2", hour(5, 11), impressions = 50, clicks = 1, spend = 200_000)
    hourly(c1, "a-rep-1", hour(6, 10), impressions = 200, clicks = 4, spend = 700_000)
    hourly(c2, "a-rep-2", hour(6, 10), impressions = 40, clicks = 0, spend = 100_000)
    hourly(c1, "a-rep-1", hour(6, 11), impressions = 150, clicks = 2, spend = 600_000)
    hourly(c1, "a-rep-1", hour(7, 10), impressions = 10, clicks = 1, spend = 50_000, closed = false)
    listOf(hour(5, 10), hour(5, 11), hour(6, 10), hour(6, 11)).forEach(::settle)

    fun sqlSum(column: String, day: Int, creativeId: Long? = null): Long =
        jdbc.queryForObject(
            "SELECT COALESCE(SUM($column), 0) FROM ad_creative_hourly WHERE campaign_id = ? AND DATE(hour_kst) = ?" +
                (creativeId?.let { " AND creative_id = $it" } ?: ""),
            Long::class.java, campaignId, LocalDate.of(2027, 1, day),
        )!!

    fun sqlCharged(day: Int): Long =
        jdbc.queryForObject(
            "SELECT COALESCE(SUM(charged_micros), 0) FROM ad_settlement WHERE campaign_id = ? AND DATE(hour_kst) = ?",
            Long::class.java, campaignId, LocalDate.of(2027, 1, day),
        )!!

    /** 정산 거래에서 퍼블리셔 미지급 계정으로 간 분개 — (시각) → 금액. */
    fun sqlPublisherShare(at: LocalDateTime): Long =
        jdbc.queryForObject(
            "SELECT e.amount_micros FROM ad_settlement s JOIN ad_ledger_entry e ON e.transaction_id = s.transaction_id " +
                "JOIN ad_ledger_account a ON a.id = e.account_id AND a.type = 'PUBLISHER_PAYABLE' WHERE s.campaign_id = ? AND s.hour_kst = ?",
            Long::class.java, campaignId, at,
        )!!

    given("광고주 리포트 (캠페인×일, 그 아래 소재)") {
        val days = api.get("/api/v1/ads/advertiser/reports?from=2027-01-05&to=2027-01-07", member).data.items()
            .filter { it["campaignId"].asLong() == campaignId }
            .associateBy { LocalDate.parse(it["date"].asString()).dayOfMonth }

        then("노출·클릭·지출은 시간별 집계 합, 청구액은 정산 합이다") {
            days.keys shouldBe setOf(5, 6, 7)
            listOf(5, 6, 7).forEach { day ->
                val row = days.getValue(day)
                row["impressions"].asLong() shouldBe sqlSum("impressions", day)
                row["clicks"].asLong() shouldBe sqlSum("clicks", day)
                row["spendMicros"].asLong() shouldBe sqlSum("spend_micros", day)
                creativeRows(row).forEach { (creativeId, c) ->
                    c["impressions"].asLong() shouldBe sqlSum("impressions", day, creativeId)
                    c["spendMicros"].asLong() shouldBe sqlSum("spend_micros", day, creativeId)
                }
            }
            days.getValue(5)["chargedMicros"].asLong() shouldBe sqlCharged(5)
            days.getValue(6)["chargedMicros"].asLong() shouldBe sqlCharged(6)
            days.getValue(5)["ctr"].asDouble() shouldBe 4.0 / 150
        }
        then("일예산을 넘은 날은 지출 ≠ 청구액이고 표시가 붙는다 — 청구는 일예산에서 멈췄다") {
            days.getValue(6)["spendMicros"].asLong() shouldBe 1_400_000L
            days.getValue(6)["chargedMicros"].asLong() shouldBe 1_000_000L
            days.getValue(6)["unbilledOverBudget"].asBoolean() shouldBe true
            days.getValue(5)["unbilledOverBudget"].asBoolean() shouldBe false
        }
        then("정산 전 시각이 있는 날은 청구액을 비우고 표시하지 않는다") {
            days.getValue(7)["chargedMicros"].isNull shouldBe true
            days.getValue(7)["unbilledOverBudget"].asBoolean() shouldBe false
        }
        then("다른 광고주에게는 이 캠페인이 보이지 않는다") {
            fixtures.memberAdvertiser(11_302)
            api.get("/api/v1/ads/advertiser/reports?from=2027-01-05&to=2027-01-07", As(11_302)).data.items()
                .none { it["campaignId"].asLong() == campaignId } shouldBe true
        }
    }

    given("퍼블리셔 리포트 (지면×일)") {
        jdbc.update(
            "INSERT INTO ad_placement_hourly (placement_key, hour_kst, requests, paid_filled, reported_paid, reported_adsense, " +
                "reported_house, reported_empty, updated_at) VALUES ('a-rep-1', ?, 1000, 120, 100, 500, 300, 100, ?)",
            hour(5, 10), hour(5, 11),
        )
        jdbc.update(
            "INSERT INTO ad_placement_hourly (placement_key, hour_kst, requests, paid_filled, updated_at) VALUES ('a-rep-1', ?, 2000, 300, ?)",
            hour(6, 10), hour(6, 11),
        )
        val rows = api.get("/api/v1/admin/ads/reports/publisher?from=2027-01-05&to=2027-01-07", As(11_399, admin = true)).data["placements"].items()
            .associateBy { it["placementKey"].asString() to LocalDate.parse(it["date"].asString()).dayOfMonth }

        then("요청·유료 채움률은 서버 집계, 채움 출처 분포는 화면 보고치(참고)로 따로 준다") {
            val day5 = rows.getValue("a-rep-1" to 5)
            day5["requests"].asLong() shouldBe 1000L
            day5["paidFilled"].asLong() shouldBe 120L
            day5["paidFillRate"].asDouble() shouldBe 0.12
            day5["clientReportedFill"]["adsense"].asLong() shouldBe 500L
            day5["clientReportedFill"]["house"].asLong() shouldBe 300L
            day5["impressions"].asLong() shouldBe 100L
            day5["clicks"].asLong() shouldBe 3L
        }
        then("퍼블리셔 몫은 정산 거래의 퍼블리셔 분개를 그 시각의 지면별 지출 비율로 나눈 합이고, RPM 은 요청 천 회당 몫이다") {
            // 01-05: 시각마다 지면이 하나라 몫이 그대로 간다
            rows.getValue("a-rep-1" to 5)["publisherRevenueMicros"].asLong() shouldBe sqlPublisherShare(hour(5, 10))
            rows.getValue("a-rep-2" to 5)["publisherRevenueMicros"].asLong() shouldBe sqlPublisherShare(hour(5, 11))
            // 01-06 10시: 두 지면이 70만:10만으로 나눈다. 11시: a-rep-1 하나
            val expected1 = sqlPublisherShare(hour(6, 10)) * 700_000 / 800_000 + sqlPublisherShare(hour(6, 11))
            val expected2 = sqlPublisherShare(hour(6, 10)) * 100_000 / 800_000
            rows.getValue("a-rep-1" to 6)["publisherRevenueMicros"].asLong() shouldBe expected1
            rows.getValue("a-rep-2" to 6)["publisherRevenueMicros"].asLong() shouldBe expected2
            rows.getValue("a-rep-1" to 6)["rpmMicros"].asLong() shouldBe expected1 * 1000 / 2000
            // 요청 행이 없는 날도 노출·몫이 있으면 나온다
            rows.getValue("a-rep-2" to 6)["requests"].asLong() shouldBe 0L
        }
    }

    given("퍼블리셔 리포트의 원장 총액 행") {
        fixtures.placement("a-led-1")
        fixtures.placement("a-led-2")
        fixtures.placement("a-led-3")
        val ledgerAdvertiser = fixtures.memberAdvertiser(12_101)
        val ledgerCampaign = fixtures.paidCampaign(ledgerAdvertiser, listOf("a-led-1", "a-led-2", "a-led-3"))
        val ledgerCreative = fixtures.paidCreative(ledgerCampaign, ledgerAdvertiser)
        val at = LocalDateTime.of(2027, 2, 10, 10, 0)
        // 지출 100,001 × 3 → 청구 300,003 → 퍼블리셔 몫 floor(× 68%) = 204,002. 지면마다 셋으로 나누면 68,000.67 → 68,000 씩
        listOf("a-led-1", "a-led-2", "a-led-3").forEach { key ->
            jdbc.update(
                "INSERT INTO ad_creative_hourly (creative_id, placement_key, hour_kst, campaign_id, advertiser_id, impressions, clicks, " +
                    "spend_micros, closed_at, updated_at) VALUES (?, ?, ?, ?, ?, 10, 0, 100001, ?, ?)",
                ledgerCreative, key, at, ledgerCampaign, ledgerAdvertiser, at.plusMinutes(70), at.plusMinutes(70),
            )
        }
        settlement.settle(CampaignHourSpend(ledgerCampaign, ledgerAdvertiser, at, 300_003), at.plusMinutes(75))

        val report = api.get("/api/v1/admin/ads/reports/publisher?from=2027-02-10&to=2027-02-10", As(11_399, admin = true)).data
        val ledgerSum = jdbc.queryForObject(
            "SELECT COALESCE(SUM(e.amount_micros), 0) FROM ad_settlement s JOIN ad_ledger_entry e ON e.transaction_id = s.transaction_id " +
                "JOIN ad_ledger_account a ON a.id = e.account_id AND a.type = 'PUBLISHER_PAYABLE' " +
                "WHERE s.hour_kst >= '2027-02-10 00:00:00' AND s.hour_kst < '2027-02-11 00:00:00'",
            Long::class.java,
        )!!
        val allocated = report["placements"].items().sumOf { it["publisherRevenueMicros"].asLong() }

        then("총액은 원장의 퍼블리셔 미지급 분개 합이고, 내림 배분한 지면 몫의 합보다 크거나 같다") {
            ledgerSum shouldBe 204_002L
            report["ledgerTotal"]["publisherPayableMicros"].asLong() shouldBe ledgerSum
            report["ledgerTotal"]["allocatedMicros"].asLong() shouldBe allocated
            allocated shouldBe 204_000L
            ledgerSum shouldBeGreaterThanOrEqual allocated
        }
    }
})

private fun creativeRows(row: JsonNode): Map<Long, JsonNode> = row["creatives"].items().associateBy { it["creativeId"].asLong() }
