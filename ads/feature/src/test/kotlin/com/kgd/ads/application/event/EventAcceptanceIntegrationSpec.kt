package com.kgd.ads.application.event

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.ads.domain.token.policy.ServeTokenSigner
import com.kgd.ads.domain.token.policy.VisitorHash
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
import com.kgd.ads.support.RedisCommandStats
import com.kgd.ads.support.adsKeyTtls
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.longs.shouldBeGreaterThan
import io.kotest.matchers.longs.shouldBeGreaterThanOrEqual
import io.kotest.matchers.longs.shouldBeLessThanOrEqual
import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import java.time.Clock
import java.time.Duration
import java.time.LocalDateTime
import java.util.Base64
import java.util.concurrent.TimeUnit
import javax.sql.DataSource

/**
 * 가시 노출 수락 — 결정 API 로 받은 실제 토큰을 이벤트 API 로 낸다(실제 MySQL·Redis).
 * 과금 여부는 응답 숫자만이 아니라 Redis 의 지출·카운터 키 값으로 판정한다.
 */
@EnabledIf(DockerAvailable::class)
class EventAcceptanceIntegrationSpec(
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
    val events = EventClient(port)
    val redis = adsRedis.template
    val mutableClock = clock as MutableClock
    val thisHour = NOON_HALF.withMinute(0)
    val today = NOON_HALF.toLocalDate()

    data class Setup(val advertiserId: Long, val campaignId: Long, val creativeId: Long)

    /** CPM 입찰 [bidMicros] → 1회 과금액 bid/1000. */
    fun paidSetup(
        key: String,
        memberId: Long,
        bidMicros: Long = 200_000,
        dailyBudgetMicros: Long = 10_000_000,
        totalBudgetMicros: Long? = null,
    ): Setup {
        fixtures.placement(key)
        val advertiserId = fixtures.memberAdvertiser(memberId)
        val campaignId = fixtures.paidCampaign(advertiserId, listOf(key), bidMicros = bidMicros, dailyBudgetMicros = dailyBudgetMicros, totalBudgetMicros = totalBudgetMicros)
        val creativeId = fixtures.paidCreative(campaignId, advertiserId)
        return Setup(advertiserId, campaignId, creativeId)
    }

    fun impressionToken(key: String, visitorId: String, userId: Long? = null): String {
        val ad = decisions.decide(listOf(key), visitorId = visitorId, userId = userId).placement(key)["ad"]
        ad.isNull shouldBe false
        return ad["impressionToken"].asString()
    }

    fun campaignSpend(campaignId: Long, hour: LocalDateTime = thisHour): Long? =
        redis.opsForValue().get(AdsRedisKeys.campaignHourSpend(campaignId, hour))?.toLong()

    fun creativeCounter(s: Setup, key: String, metric: String): String? =
        redis.opsForHash<String, String>().get(
            AdsRedisKeys.creativeHour(thisHour),
            AdsRedisKeys.creativeFieldPrefix(s.creativeId, s.campaignId, s.advertiserId, key) + ":" + metric,
        )

    given("★ 같은 노출 토큰을 두 번 내면") {
        then("과금은 한 번, 두 번째는 duplicate — 지출·노출·빈도·광고주 지출이 한 번만 오른다") {
            val s = paidSetup("e-dup", memberId = 9001)
            refreshIndex.refresh()
            val token = impressionToken("e-dup", "vid-dup")

            val first = events.events(listOf(token), visitorId = "vid-dup")
            first.status shouldBe 200
            first.accepted shouldBe 1
            val second = events.events(listOf(token), visitorId = "vid-dup")
            second.accepted shouldBe 0
            second.rejected("duplicate") shouldBe 1
            // 한 묶음 안에 같은 토큰이 두 번 있어도 한 번만
            events.events(listOf(token, token), visitorId = "vid-dup").rejected("duplicate") shouldBe 2

            campaignSpend(s.campaignId) shouldBe 200L
            redis.opsForValue().get(AdsRedisKeys.advertiserHourSpend(s.advertiserId, thisHour)) shouldBe "200"
            creativeCounter(s, "e-dup", AdsRedisKeys.METRIC_IMPRESSIONS) shouldBe "1"
            creativeCounter(s, "e-dup", AdsRedisKeys.METRIC_SPEND) shouldBe "200"
            redis.opsForValue().get(AdsRedisKeys.frequency(VisitorHash.of("vid-dup"), s.campaignId, today)) shouldBe "1"
        }
    }

    given("★ 결정 때 시간당 상한 아래였던 토큰을 모아 한꺼번에 내면") {
        then("상한을 넘는 몫은 over_budget 이고 과금하지 않는다 — Redis 지출이 상한을 넘지 않는다") {
            // 일예산 1,000,000 → 시간당 상한 250,000. CPM 100,000,000 → 1회 과금액 100,000 → 한 시각에 둘까지
            val s = paidSetup("e-cap", memberId = 9002, bidMicros = 100_000_000, dailyBudgetMicros = 1_000_000)
            refreshIndex.refresh()
            val tokens = (1..4).map { impressionToken("e-cap", "vid-cap") }

            val response = events.events(tokens, visitorId = "vid-cap")
            response.accepted shouldBe 2
            response.rejected("over_budget") shouldBe 2
            campaignSpend(s.campaignId) shouldBe 200_000L
            campaignSpend(s.campaignId)!! shouldBeLessThanOrEqual 250_000L
            creativeCounter(s, "e-cap", AdsRedisKeys.METRIC_IMPRESSIONS) shouldBe "2"
        }
    }

    given("총예산 — 정산 완료 시각 뒤의 미정산 지출까지 더해 본다") {
        then("총예산 남은 몫을 넘는 노출은 over_budget") {
            // 총예산 1,000,000, 1회 과금액 100,000, 09시까지 정산 · 10시 미정산 지출 850,000 → 이번 시각에 하나만
            val s = paidSetup("e-total", memberId = 9003, bidMicros = 100_000_000, dailyBudgetMicros = 10_000_000, totalBudgetMicros = 1_000_000)
            fixtures.settledThrough(s.advertiserId, today.atTime(9, 0))
            redis.opsForValue().set(AdsRedisKeys.campaignHourSpend(s.campaignId, today.atTime(10, 0)), "850000", Duration.ofHours(1))
            refreshIndex.refresh()
            val tokens = (1..2).map { impressionToken("e-total", "vid-total") }

            val response = events.events(tokens, visitorId = "vid-total")
            response.accepted shouldBe 1
            response.rejected("over_budget") shouldBe 1
            campaignSpend(s.campaignId) shouldBe 100_000L
        }
    }

    given("묶음 부분 수락 — 유효 2 · 위조 1") {
        then("유효한 둘만 수락하고 위조는 invalid_signature") {
            val s = paidSetup("e-partial", memberId = 9004)
            refreshIndex.refresh()
            val valid = (1..2).map { impressionToken("e-partial", "vid-partial") }
            val (payload, mac) = impressionToken("e-partial", "vid-partial").split('.')
            val forgedPayload = String(Base64.getUrlDecoder().decode(payload)).replace("|200|", "|1|")
            val forged = Base64.getUrlEncoder().withoutPadding().encodeToString(forgedPayload.toByteArray()) + "." + mac

            val response = events.events(valid + forged, visitorId = "vid-partial")
            response.accepted shouldBe 2
            response.rejected("invalid_signature") shouldBe 1
            campaignSpend(s.campaignId) shouldBe 400L
        }
    }

    given("일회성 표식의 수명") {
        then("PTTL 이 토큰의 남은 수명 이상이다") {
            paidSetup("e-pttl", memberId = 9005)
            refreshIndex.refresh()
            val token = impressionToken("e-pttl", "vid-pttl")
            val decisionId = String(Base64.getUrlDecoder().decode(token.substringBefore('.'))).split('|')[1]

            val acceptedAt = NOON_HALF.plusMinutes(20)
            mutableClock.set(acceptedAt)
            try {
                events.events(listOf(token), visitorId = "vid-pttl").accepted shouldBe 1
                val remainingLife = Duration.between(acceptedAt, NOON_HALF.plus(ServeTokenSigner.LIFETIME))
                val pttl = requireNotNull(redis.getExpire(AdsRedisKeys.oneTimeMarker(TokenKind.IMP, decisionId, "e-pttl"), TimeUnit.MILLISECONDS))
                pttl shouldBeGreaterThanOrEqual remainingLife.toMillis()
            } finally {
                mutableClock.set(NOON_HALF)
            }
        }
    }

    given("과금하지 않는 토큰") {
        then("다른 방문자가 낸 토큰은 visitor_mismatch, 방문자 헤더가 없어도 visitor_mismatch — 지출 키가 생기지 않는다") {
            val s = paidSetup("e-visitor", memberId = 9006)
            refreshIndex.refresh()
            val token = impressionToken("e-visitor", "vid-owner-of-token")

            events.events(listOf(token), visitorId = "vid-someone-else").rejected("visitor_mismatch") shouldBe 1
            events.events(listOf(token), visitorId = null).rejected("visitor_mismatch") shouldBe 1
            campaignSpend(s.campaignId) shouldBe null
            // 같은 토큰을 제 방문자가 내면 받는다 — 거절이 표식을 쓰지 않았다
            events.events(listOf(token), visitorId = "vid-owner-of-token").accepted shouldBe 1
        }
        then("광고주 본인에게 나간 토큰은 not_billable") {
            val s = paidSetup("e-owner", memberId = 9007)
            refreshIndex.refresh()
            val token = impressionToken("e-owner", "vid-owner", userId = 9007)

            val response = events.events(listOf(token), visitorId = "vid-owner")
            response.accepted shouldBe 0
            response.rejected("not_billable") shouldBe 1
            campaignSpend(s.campaignId) shouldBe null
            creativeCounter(s, "e-owner", AdsRedisKeys.METRIC_IMPRESSIONS) shouldBe null
        }
    }

    given("크롤러 UA") {
        then("수락 0 · crawler 로 답하고 ads Redis 에 명령을 보내지 않는다") {
            paidSetup("e-crawler", memberId = 9008)
            refreshIndex.refresh()
            val token = impressionToken("e-crawler", "vid-crawler")
            val stats = RedisCommandStats(redis)

            stats.reset()
            val response = events.events(listOf(token), visitorId = "vid-crawler", fills = listOf("e-crawler" to "PAID"), userAgent = DecisionClient.CRAWLER_UA)
            response.accepted shouldBe 0
            response.rejected("crawler") shouldBe 1
            stats.calls().shouldBeEmpty()

            // 대조군 — 같은 토큰을 사람이 내면 스크립트 한 번(eval/evalsha)으로 끝난다
            stats.reset()
            events.events(listOf(token), visitorId = "vid-crawler").accepted shouldBe 1
            val calls = stats.calls()
            ((calls["evalsha"] ?: 0L) + (calls["eval"] ?: 0L)) shouldBe 1L
            (calls.keys - setOf("evalsha", "eval", "set", "get", "incr", "incrby", "hincrby", "expire")) shouldBe emptySet()
        }
    }

    given("지면별 최종 채움 출처") {
        then("등록된 지면의 허용 값 넷만 세고, 모르는 값·미등록 지면은 버린다 — text/plain 본문도 같다") {
            fixtures.placement("e-fill-a")
            fixtures.placement("e-fill-b")
            refreshIndex.refresh()

            val response = events.events(
                tokens = emptyList(),
                fills = listOf("e-fill-a" to "ADSENSE", "e-fill-b" to "HOUSE", "e-fill-a" to "PAID", "e-fill-b" to "BOGUS", "not-registered" to "EMPTY"),
            )
            response.status shouldBe 200
            events.events(tokens = emptyList(), fills = listOf("e-fill-b" to "EMPTY"), contentType = "text/plain;charset=UTF-8").status shouldBe 200

            val a = redis.opsForHash<String, String>().entries(AdsRedisKeys.placementHour("e-fill-a", thisHour))
            a shouldBe mapOf("reported_adsense" to "1")
            val b = redis.opsForHash<String, String>().entries(AdsRedisKeys.placementHour("e-fill-b", thisHour))
            b shouldBe mapOf("reported_house" to "1", "reported_empty" to "1")
            redis.hasKey(AdsRedisKeys.placementHour("not-registered", thisHour)) shouldBe false
        }
        then("토큰 51개나 채움 21개는 400") {
            events.events(tokens = List(51) { "x" }).status shouldBe 400
            events.events(tokens = emptyList(), fills = List(21) { "e-fill-a" to "PAID" }).status shouldBe 400
            events.events(tokens = List(50) { "x" }).status shouldBe 200
        }
    }

    given("ads Redis 키의 수명") {
        then("지금까지 쓴 ads 키 전부 TTL 이 있다") {
            val ttls = adsKeyTtls(redis)
            (ttls.size.toLong()) shouldBeGreaterThan 0L
            ttls.filterValues { it <= 0 }.shouldBeEmpty()
        }
    }

    // 컨테이너를 멈추므로 맨 끝에 둔다.
    given("ads Redis 가 응답하지 않으면") {
        then("200 으로 수락 0 · redis_unavailable 을 1초 안에 준다") {
            paidSetup("e-redis-down", memberId = 9009)
            refreshIndex.refresh()
            val token = impressionToken("e-redis-down", "vid-down")

            AdsTestContainers.pauseRedis()
            try {
                val started = System.nanoTime()
                val response = events.events(listOf(token), visitorId = "vid-down")
                Duration.ofNanos(System.nanoTime() - started).toMillis() shouldBeLessThanOrEqual 1_000L
                response.status shouldBe 200
                response.accepted shouldBe 0
                response.rejected("redis_unavailable") shouldBe 1
            } finally {
                AdsTestContainers.unpauseRedis()
            }
        }
    }
})
