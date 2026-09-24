package com.kgd.ads.application.event

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.domain.token.policy.ServeTokenSigner
import com.kgd.ads.infrastructure.redis.AdsRedisConnection
import com.kgd.ads.infrastructure.redis.AdsRedisKeys
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.NOON_HALF
import com.kgd.ads.support.AdsTestContainers
import com.kgd.ads.support.DecisionClient
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.EventClient
import com.kgd.ads.support.MutableClock
import com.kgd.ads.support.adsKeyTtls
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import java.net.http.HttpResponse
import java.time.Clock
import java.time.LocalDateTime
import java.util.Base64
import javax.sql.DataSource

/**
 * 클릭 리다이렉터 — 결정 API 로 받은 실제 클릭 주소를 부른다. 목적지는 302 의 Location, 과금은 Redis 지출 키로 판정한다.
 * CPC 캠페인(입찰 100,000 → 클릭 1회 과금액 100,000)으로 클릭이 곧 과금이 되게 한다.
 */
@EnabledIf(DockerAvailable::class)
class ClickRedirectIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired refreshIndex: RefreshCandidateIndexUseCase,
    @Autowired adsRedis: AdsRedisConnection,
    @Autowired @Qualifier("adsClock") clock: Clock,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val port = env.getRequiredProperty("local.server.port").toInt()
    val decisions = DecisionClient(port)
    val client = EventClient(port)
    val redis = adsRedis.template
    val mutableClock = clock as MutableClock
    val thisHour = NOON_HALF.withMinute(0)
    val charge = 100_000L

    /** @return (캠페인 id, 소재 id) */
    fun cpcSetup(key: String, memberId: Long): Pair<Long, Long> {
        fixtures.placement(key)
        val advertiserId = fixtures.memberAdvertiser(memberId)
        val campaignId = fixtures.paidCampaign(advertiserId, listOf(key), bidType = "CPC", bidMicros = charge, dailyBudgetMicros = 10_000_000)
        return campaignId to fixtures.paidCreative(campaignId, advertiserId)
    }

    fun clickToken(key: String, visitorId: String): String {
        val ad = decisions.decide(listOf(key), visitorId = visitorId).placement(key)["ad"]
        ad.isNull shouldBe false
        return ad["clickUrl"].asString().substringAfterLast('/')
    }

    fun spend(campaignId: Long, hour: LocalDateTime = thisHour): Long =
        redis.opsForValue().get(AdsRedisKeys.campaignHourSpend(campaignId, hour))?.toLong() ?: 0L

    fun HttpResponse<*>.shouldRedirectTo(location: String) {
        statusCode() shouldBe 302
        headers().firstValue("Location").orElse(null) shouldBe location
        headers().firstValue("Cache-Control").orElse(null) shouldBe "no-store"
        headers().firstValue("X-Robots-Tag").orElse(null) shouldBe "noindex, nofollow"
    }

    given("정상 클릭") {
        then("DB 의 소재 랜딩으로 보내고 한 번 과금한다 — 결정 뒤 랜딩을 바꾸면 바뀐 곳으로 간다, 재사용은 랜딩으로 가되 과금 없음") {
            val (campaignId, creativeId) = cpcSetup("c-normal", memberId = 7001)
            refreshIndex.refresh()
            val token = clickToken("c-normal", "vid-c-normal")
            jdbc.update("UPDATE ad_creative SET link_url = 'https://example.com/changed' WHERE id = ?", creativeId)

            client.click(token, visitorId = "vid-c-normal").shouldRedirectTo("https://example.com/changed")
            spend(campaignId) shouldBe charge

            client.click(token, visitorId = "vid-c-normal").shouldRedirectTo("https://example.com/changed")
            spend(campaignId) shouldBe charge
        }
    }

    given("서명이 틀린 클릭") {
        then("홈(/)으로 보내고 과금하지 않는다") {
            val (campaignId, _) = cpcSetup("c-forged", memberId = 7002)
            refreshIndex.refresh()
            val (payload, mac) = clickToken("c-forged", "vid-c-forged").split('.')
            val forged = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(String(Base64.getUrlDecoder().decode(payload)).replace("|$charge|", "|1|").toByteArray()) + "." + mac

            client.click(forged, visitorId = "vid-c-forged").shouldRedirectTo("/")
            client.click("not-a-token", visitorId = "vid-c-forged").shouldRedirectTo("/")
            spend(campaignId) shouldBe 0L
        }
    }

    given("승인이 거둬진 소재의 클릭") {
        then("홈(/)으로 보내고 과금하지 않는다") {
            val (campaignId, creativeId) = cpcSetup("c-rejected", memberId = 7003)
            refreshIndex.refresh()
            val token = clickToken("c-rejected", "vid-c-rejected")
            fixtures.reject(creativeId)

            client.click(token, visitorId = "vid-c-rejected").shouldRedirectTo("/")
            spend(campaignId) shouldBe 0L
        }
    }

    given("수명이 지난 클릭") {
        then("랜딩으로는 보내되 과금하지 않는다") {
            val (campaignId, _) = cpcSetup("c-expired", memberId = 7004)
            refreshIndex.refresh()
            val token = clickToken("c-expired", "vid-c-expired")

            val later = NOON_HALF.plus(ServeTokenSigner.LIFETIME).plusSeconds(1)
            mutableClock.set(later)
            try {
                client.click(token, visitorId = "vid-c-expired").shouldRedirectTo("https://example.com/landing")
            } finally {
                mutableClock.set(NOON_HALF)
            }
            spend(campaignId) shouldBe 0L
            spend(campaignId, later.withMinute(0).withSecond(0)) shouldBe 0L
        }
    }

    given("같은 방문자가 10분 안에 여섯 번 클릭하면") {
        then("다섯 번까지 과금하고 여섯째는 랜딩으로 보내되 과금하지 않는다") {
            val (campaignId, _) = cpcSetup("c-rate", memberId = 7005)
            refreshIndex.refresh()
            val tokens = (1..6).map { clickToken("c-rate", "vid-c-rate") }

            tokens.forEach { client.click(it, visitorId = "vid-c-rate").shouldRedirectTo("https://example.com/landing") }
            spend(campaignId) shouldBe 5 * charge
        }
    }

    given("ads Redis 키의 수명") {
        then("클릭이 쓴 키를 포함해 ads 키 전부 TTL 이 있다") {
            adsKeyTtls(redis).filterValues { it <= 0 }.shouldBeEmpty()
        }
    }

    // 컨테이너를 멈추므로 맨 끝에 둔다.
    given("ads Redis 가 응답하지 않아도") {
        then("클릭은 랜딩으로 보낸다 — 기록 실패가 리다이렉트를 막지 않는다") {
            cpcSetup("c-redis-down", memberId = 7006)
            refreshIndex.refresh()
            val token = clickToken("c-redis-down", "vid-c-down")

            AdsTestContainers.pauseRedis()
            try {
                client.click(token, visitorId = "vid-c-down").shouldRedirectTo("https://example.com/landing")
            } finally {
                AdsTestContainers.unpauseRedis()
            }
        }
    }
})
