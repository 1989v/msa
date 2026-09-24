package com.kgd.ads.application.event

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.application.settlement.dto.CampaignHourSpend
import com.kgd.ads.application.settlement.service.SettlementTransactionalService
import com.kgd.ads.domain.token.policy.VisitorHash
import com.kgd.ads.infrastructure.messaging.AnalyticsCopyKafkaAdapter
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
import com.kgd.ads.support.RecordingAnalyticsCopy
import com.kgd.ads.support.SettlementFixtures
import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.longs.shouldBeLessThan
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import tools.jackson.databind.JsonNode
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.util.Base64
import javax.sql.DataSource

/**
 * 수락한 노출·클릭의 analytics 원장 사본(I13). 결정·이벤트·클릭은 실제 HTTP 로 부르고, 사본은 발행 포트를 대신하는
 * [RecordingAnalyticsCopy] 가 받은 것을 본다. 기대값은 결정 응답(결정 id)과 이벤트 요청에 실은 신원에서 온다.
 *
 * 시계는 2027-02-02 12:30 KST, 회원 120xx. 정산은 집계 작업 대신 이 스펙의 (캠페인, 시각)에만 운영 정산 트랜잭션을 부른다.
 */
@EnabledIf(DockerAvailable::class)
class AnalyticsCopyIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired refreshIndex: RefreshCandidateIndexUseCase,
    @Autowired adsRedis: AdsRedisConnection,
    @Autowired @Qualifier("adsClock") clock: Clock,
    @Autowired copies: RecordingAnalyticsCopy,
    @Autowired settlement: SettlementTransactionalService,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val rows = SettlementFixtures(jdbc, adsRedis.template)
    val port = env.getRequiredProperty("local.server.port").toInt()
    val decisions = DecisionClient(port)
    val events = EventClient(port)
    val redis = adsRedis.template
    val mutableClock = clock as MutableClock
    val now = LocalDateTime.of(2027, 2, 2, 12, 30)
    val thisHour = now.withMinute(0)

    beforeSpec { mutableClock.set(now) }
    afterSpec {
        mutableClock.set(NOON_HALF)
        copies.failing = false
    }

    data class Setup(val advertiserId: Long, val campaignId: Long, val creativeId: Long)

    fun paidSetup(key: String, memberId: Long, host: String, bidType: String = "CPM", bidMicros: Long = 200_000): Setup {
        fixtures.placement(key, host = host)
        val advertiserId = fixtures.memberAdvertiser(memberId)
        val campaignId = fixtures.paidCampaign(advertiserId, listOf(key), bidType = bidType, bidMicros = bidMicros)
        return Setup(advertiserId, campaignId, fixtures.paidCreative(campaignId, advertiserId))
    }

    /** @return (결정 id, 광고) */
    fun decide(key: String, visitorId: String, host: String = AdsFixtures.BLOG_HOST): Pair<String, JsonNode> {
        val response = decisions.decide(listOf(key), host = host, visitorId = visitorId)
        val ad = response.placement(key)["ad"]
        ad.isNull shouldBe false
        return response.body["data"]["decisionId"].asString() to ad
    }

    fun campaignSpend(campaignId: Long): Long =
        redis.opsForValue().get(AdsRedisKeys.campaignHourSpend(campaignId, thisHour))?.toLong() ?: 0L

    fun AnalyticsEvent.shouldBeCopyOf(s: Setup, action: EventAction, decisionId: String, placementKey: String, screenType: String) {
        entityType shouldBe EntityType.AD
        entityId shouldBe s.creativeId.toString()
        this.action shouldBe action
        viewId shouldBe decisionId
        placement?.sectionId shouldBe "AD:$placementKey"
        placement?.screenType shouldBe screenType
        placement?.itemIndex shouldBe 0
        userId shouldBe null
        timestamp shouldBe now.atZone(KST).toInstant()
    }

    given("★ 수락한 가시 노출") {
        val s = paidSetup("ac-imp", memberId = 12_001, host = GAME_HOST)
        refreshIndex.refresh()
        val (decisionId, ad) = decide("ac-imp", "vid-ac-imp", GAME_HOST)
        val token = ad["impressionToken"].asString()

        then("사본 한 건 — 대상 AD·소재 id·IMPRESSION·결정 id·요청의 analytics 신원·AD:{지면 키}·호스트의 화면 종류") {
            events.events(listOf(token), visitorId = "vid-ac-imp").accepted shouldBe 1

            val copy = copies.forCreative(s.creativeId).single()
            copy.shouldBeCopyOf(s, EventAction.IMPRESSION, decisionId, "ac-imp", screenType = "GAME_HUB")
            copy.visitorId shouldBe "identity-visitor"
            copy.sessionId shouldBe "identity-session"
        }
        then("거절된 이벤트(중복·서명 불량)와 크롤러 요청은 사본을 내지 않는다") {
            events.events(listOf(token), visitorId = "vid-ac-imp").rejected("duplicate") shouldBe 1
            val forged = token.substringBeforeLast('.') + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32))
            events.events(listOf(forged), visitorId = "vid-ac-imp").rejected("invalid_signature") shouldBe 1
            val (_, crawlerAd) = decide("ac-imp", "vid-ac-imp", GAME_HOST)
            events.events(listOf(crawlerAd["impressionToken"].asString()), visitorId = "vid-ac-imp", userAgent = DecisionClient.CRAWLER_UA)
                .rejected("crawler") shouldBe 1

            copies.forCreative(s.creativeId).size shouldBe 1
        }
    }

    given("★ 수락한 클릭") {
        val s = paidSetup("ac-clk", memberId = 12_002, host = AdsFixtures.BLOG_HOST, bidType = "CPC", bidMicros = 100_000)
        refreshIndex.refresh()

        then("사본 한 건 — CLICK·결정 id. 클릭 주소에는 화면 신원이 없어 방문자는 토큰의 방문자 해시, 세션은 비운다") {
            val (decisionId, ad) = decide("ac-clk", "vid-ac-clk")
            events.click(ad["clickUrl"].asString().substringAfterLast('/'), visitorId = "vid-ac-clk").statusCode() shouldBe 302

            val copy = copies.forCreative(s.creativeId).single()
            copy.shouldBeCopyOf(s, EventAction.CLICK, decisionId, "ac-clk", screenType = "BLOG_POST")
            copy.visitorId shouldBe VisitorHash.of("vid-ac-clk")
            copy.sessionId shouldBe ""
        }
        then("화면이 클릭 주소에 신원(vid·sid)을 붙이면 사본의 방문자·세션이 노출 사본과 같은 값이다") {
            val (decisionId, ad) = decide("ac-clk", "vid-ac-clk-id")
            events.click(ad["clickUrl"].asString().substringAfterLast('/'), visitorId = "vid-ac-clk-id", query = "vid=identity-visitor&sid=identity-session")
                .statusCode() shouldBe 302

            val copy = copies.forCreative(s.creativeId).single { it.viewId == decisionId }
            copy.shouldBeCopyOf(s, EventAction.CLICK, decisionId, "ac-clk", screenType = "BLOG_POST")
            copy.visitorId shouldBe "identity-visitor"
            copy.sessionId shouldBe "identity-session"
        }
        then("크롤러의 클릭은 랜딩으로 보내되 사본을 내지 않는다") {
            val (_, ad) = decide("ac-clk", "vid-ac-clk-2")
            events.click(ad["clickUrl"].asString().substringAfterLast('/'), visitorId = "vid-ac-clk-2", userAgent = DecisionClient.CRAWLER_UA)
                .statusCode() shouldBe 302

            copies.forCreative(s.creativeId).size shouldBe 2
        }
    }

    given("★ 사본 발행이 실패하면") {
        val s = paidSetup("ac-fail", memberId = 12_003, host = AdsFixtures.BLOG_HOST)
        refreshIndex.refresh()
        val tokens = listOf(decide("ac-fail", "vid-ac-fail").second, decide("ac-fail", "vid-ac-fail").second)
            .map { it["impressionToken"].asString() }

        then("수락·지출 카운터·정산은 그대로다 — 사본만 없다") {
            copies.failing = true
            val response = try {
                events.events(tokens, visitorId = "vid-ac-fail")
            } finally {
                copies.failing = false
            }

            response.status shouldBe 200
            response.accepted shouldBe 2
            // CPM 200,000 → 1회 200
            campaignSpend(s.campaignId) shouldBe 400L
            copies.forCreative(s.creativeId).shouldBeEmpty()

            settlement.settle(CampaignHourSpend(s.campaignId, s.advertiserId, thisHour, campaignSpend(s.campaignId)), now.plusHours(1))
            rows.settlements(s.campaignId).getValue(thisHour).first shouldBe 400L
            rows.walletBalance(s.advertiserId) shouldBe 100_000_000L - 400
        }
    }

    given("운영 Kafka 어댑터 — 브로커에 닿지 않을 때") {
        then("던지지 않고, 첫 건의 대기에서 멈춰 묶음 전체를 기다리지 않는다") {
            val adapter = AnalyticsCopyKafkaAdapter("127.0.0.1:1")
            val batch = (1..10).map { i ->
                AnalyticsEvent(
                    eventId = "ac-dead-$i", entityType = EntityType.AD, entityId = "1", action = EventAction.IMPRESSION,
                    userId = null, visitorId = "v", sessionId = "s", timestamp = Instant.EPOCH, experimentAssignments = null, payload = emptyMap(),
                )
            }
            try {
                val started = System.nanoTime()
                adapter.publish(batch)
                val elapsedMs = (System.nanoTime() - started) / 1_000_000
                // 건마다 기다리면 10 × 500ms. 첫 건에서 멈추면 한 번의 대기 + 생산자 생성
                elapsedMs shouldBeLessThan 2_500L
            } finally {
                adapter.destroy()
            }
        }
    }
})

private const val GAME_HOST = "game.1989v.com"
