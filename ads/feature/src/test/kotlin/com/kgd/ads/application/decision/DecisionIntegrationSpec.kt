package com.kgd.ads.application.decision

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.domain.token.model.EventRejectReason
import com.kgd.ads.domain.token.model.TokenKind
import com.kgd.ads.domain.token.model.TokenVerification
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
import com.kgd.ads.support.RedisCommandStats
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.longs.shouldBeGreaterThan
import io.kotest.matchers.longs.shouldBeLessThanOrEqual
import io.kotest.matchers.maps.shouldContainKey
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import java.time.Duration
import java.time.LocalDateTime
import javax.sql.DataSource

/**
 * 광고 결정 — 실제 MySQL·Redis 로, 운영과 같은 HTTP 경로를 부른다.
 * 시각은 2026-09-23 12:30 KST 로 고정하고, 페이싱은 항상 통과시켜 차단 경로 하나씩만 본다.
 */
@EnabledIf(DockerAvailable::class)
class DecisionIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired refreshIndex: RefreshCandidateIndexUseCase,
    @Autowired adsRedis: AdsRedisConnection,
    @Autowired signer: ServeTokenSigner,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val client = DecisionClient(env.getRequiredProperty("local.server.port").toInt())
    val redis = adsRedis.template
    val today = NOON_HALF.toLocalDate()
    val thisHour = NOON_HALF.withMinute(0)

    /** 지면 하나에 광고주·캠페인·승인 소재 하나. @return (광고주 id, 캠페인 id) */
    fun paidSetup(
        key: String,
        memberId: Long,
        balanceMicros: Long = 100_000_000,
        dailyBudgetMicros: Long = 10_000_000,
        categories: Set<String> = emptySet(),
    ): Pair<Long, Long> {
        fixtures.placement(key)
        val advertiserId = fixtures.memberAdvertiser(memberId, balanceMicros)
        val campaignId = fixtures.paidCampaign(advertiserId, listOf(key), dailyBudgetMicros = dailyBudgetMicros, categories = categories)
        fixtures.paidCreative(campaignId, advertiserId)
        return advertiserId to campaignId
    }

    fun comStatus(): Map<String, Long> = jdbc.queryForList(
        "SHOW GLOBAL STATUS WHERE Variable_name IN ('Com_select', 'Com_insert', 'Com_update', 'Com_delete')",
    ).associate { it["Variable_name"] as String to (it["Value"] as String).toLong() }

    given("등록된 지면에 승인된 유료 소재가 있으면") {
        then("광고·노출/클릭 토큰을 내고, HOUSE 전용 지면은 HOUSE 목록을, 지면 카운터는 TTL 과 함께 오른다") {
            paidSetup("t-basic", memberId = 5001)
            refreshIndex.refresh()

            val response = client.decide(listOf("t-basic", "game-list-banner"))
            response.status shouldBe 200
            val ad = response.placement("t-basic")["ad"]
            ad["title"].asString() shouldBe "가을 세일"
            ad["impressionToken"].asString().isNotBlank() shouldBe true
            ad["clickUrl"].asString().startsWith("/api/v1/ads/click/") shouldBe true
            val banner = response.placement("game-list-banner")
            banner["ad"].isNull shouldBe true
            banner["reason"].asString() shouldBe "no_candidates"
            banner["house"].let { house -> (0 until house.size()).map { house[it]["title"].asString() } } shouldBe listOf("IT 개념 사전", "커머스 쇼핑", "포트폴리오")

            val counterKey = AdsRedisKeys.placementHour("t-basic", thisHour)
            redis.opsForHash<String, String>().get(counterKey, AdsRedisKeys.FIELD_REQUESTS) shouldBe "1"
            redis.opsForHash<String, String>().get(counterKey, AdsRedisKeys.FIELD_PAID_FILLED) shouldBe "1"
            val ttl = redis.getExpire(counterKey)
            ttl shouldBeGreaterThan 0
            ttl shouldBeLessThanOrEqual Duration.ofHours(AdsRedisKeys.COUNTER_TTL_HOURS).seconds
        }
    }

    given("차단 경로 — 방문자 빈도") {
        then("오늘 본 횟수가 빈도 제한 3 에 하나 모자라면 나가고, 닿으면 빠진다") {
            val (_, campaignId) = paidSetup("t-freq", memberId = 5002)
            refreshIndex.refresh()
            val freqKey = AdsRedisKeys.frequency(VisitorHash.of("vid-freq"), campaignId, today)

            redis.opsForValue().set(freqKey, "2", Duration.ofHours(1))
            client.decide(listOf("t-freq"), visitorId = "vid-freq").placement("t-freq")["ad"].isNull shouldBe false

            redis.opsForValue().set(freqKey, "3", Duration.ofHours(1))
            val blocked = client.decide(listOf("t-freq"), visitorId = "vid-freq").placement("t-freq")
            blocked["ad"].isNull shouldBe true
            blocked["reason"].asString() shouldBe "no_candidates"
            // 다른 방문자는 여전히 받는다
            client.decide(listOf("t-freq"), visitorId = "vid-other").placement("t-freq")["ad"].isNull shouldBe false
        }
    }

    given("차단 경로 — 문맥 카테고리") {
        then("GAME 만 타기팅한 캠페인은 TECH 문맥(블로그 호스트 기본)에 안 나가고 GAME 으로 매핑된 문맥에는 나간다") {
            paidSetup("t-cat", memberId = 5003, categories = setOf("GAME"))
            fixtures.contextMapping("blog:game-dev", "GAME")
            refreshIndex.refresh()

            client.decide(listOf("t-cat"), contextKey = "blog:rust").placement("t-cat")["ad"].isNull shouldBe true
            client.decide(listOf("t-cat"), contextKey = "blog:game-dev").placement("t-cat")["ad"].isNull shouldBe false
        }
    }

    given("차단 경로 — 실시간 지출로 일예산 소진") {
        then("정산 뒤 지출이 일예산 − 1회 과금액이면 나가고, 1 마이크로라도 넘으면 빠진다") {
            // 일예산 1,000,000 · CPM 200,000 → 1회 과금액 200. 06시까지 정산됨 → 07~12시가 미정산
            val (advertiserId, campaignId) = paidSetup("t-budget", memberId = 5004, dailyBudgetMicros = 1_000_000)
            fixtures.settledThrough(advertiserId, today.atTime(6, 0))
            refreshIndex.refresh()
            val spendKey = AdsRedisKeys.campaignHourSpend(campaignId, today.atTime(8, 0))

            redis.opsForValue().set(spendKey, "999800", Duration.ofHours(1))
            client.decide(listOf("t-budget")).placement("t-budget")["ad"].isNull shouldBe false

            redis.opsForValue().set(spendKey, "999801", Duration.ofHours(1))
            client.decide(listOf("t-budget")).placement("t-budget")["ad"].isNull shouldBe true
        }
    }

    given("차단 경로 — 지갑 여유") {
        then("잔액 − 정산 뒤 광고주 지출이 1회 과금액이면 나가고, 0 이면 빠진다") {
            val (advertiserId, _) = paidSetup("t-wallet", memberId = 5005, balanceMicros = 1_000_000)
            fixtures.settledThrough(advertiserId, today.atTime(10, 0))
            refreshIndex.refresh()
            val spendKey = AdsRedisKeys.advertiserHourSpend(advertiserId, today.atTime(11, 0))

            redis.opsForValue().set(spendKey, "999800", Duration.ofHours(1))
            client.decide(listOf("t-wallet")).placement("t-wallet")["ad"].isNull shouldBe false

            redis.opsForValue().set(spendKey, "1000000", Duration.ofHours(1))
            client.decide(listOf("t-wallet")).placement("t-wallet")["ad"].isNull shouldBe true
        }
    }

    given("정산이 6시간 넘게 멈춘 광고주") {
        then("지출이 없어도 후보에서 빠진다") {
            val (advertiserId, _) = paidSetup("t-stale", memberId = 5006)
            fixtures.settledThrough(advertiserId, today.atTime(5, 0))
            refreshIndex.refresh()
            client.decide(listOf("t-stale")).placement("t-stale")["ad"].isNull shouldBe true
        }
    }

    given("광고주 본인 판정") {
        then("결정 요청의 X-User-Id 가 캠페인 소유 회원이면 광고는 보이되 두 토큰 모두 과금하지 않는다") {
            paidSetup("t-owner", memberId = 5007)
            refreshIndex.refresh()
            val visitorHash = VisitorHash.of("vid-owner")

            val own = client.decide(listOf("t-owner"), visitorId = "vid-owner", userId = 5007).placement("t-owner")["ad"]
            own.isNull shouldBe false
            listOf(TokenKind.IMP to own["impressionToken"].asString(), TokenKind.CLK to own["clickUrl"].asString().substringAfterLast('/'))
                .forEach { (kind, token) ->
                    val verdict = signer.verify(token, kind, visitorHash)
                    verdict.shouldBeInstanceOf<TokenVerification.Rejected>()
                    verdict.reason shouldBe EventRejectReason.NOT_BILLABLE
                }
        }
        then("다른 회원이나 비로그인이면 과금 토큰이다") {
            val visitorHash = VisitorHash.of("vid-owner")
            listOf(8888L, null).forEach { userId ->
                val ad = client.decide(listOf("t-owner"), visitorId = "vid-owner", userId = userId).placement("t-owner")["ad"]
                signer.verify(ad["impressionToken"].asString(), TokenKind.IMP, visitorHash).shouldBeInstanceOf<TokenVerification.Accepted>()
                signer.verify(ad["clickUrl"].asString().substringAfterLast('/'), TokenKind.CLK, visitorHash)
                    .shouldBeInstanceOf<TokenVerification.Accepted>()
            }
        }
    }

    given("등록부에 없는 지면 키") {
        then("unregistered_placement 로 답하고 키별 요청 수를 TTL 있는 카운터에 쌓는다 — 형식이 틀린 키는 세지 않는다") {
            refreshIndex.refresh()
            repeat(2) {
                val response = client.decide(listOf("mystery-slot", "Bad Key!"))
                response.placement("mystery-slot")["reason"].asString() shouldBe "unregistered_placement"
                response.placement("Bad Key!")["reason"].asString() shouldBe "unregistered_placement"
            }
            val key = AdsRedisKeys.unregisteredHour(thisHour)
            redis.opsForHash<String, String>().entries(key) shouldBe mapOf("mystery-slot" to "2")
            redis.getExpire(key) shouldBeGreaterThan 0
        }
    }

    given("크롤러 UA") {
        then("광고·토큰 없이 답하고 ads Redis 에 명령을 한 번도 보내지 않는다 — 사람 UA 는 읽기 한 번(MGET)·쓰기 스크립트 한 번") {
            paidSetup("t-crawler", memberId = 5008)
            refreshIndex.refresh()
            val stats = RedisCommandStats(redis)

            stats.reset()
            val crawler = client.decide(listOf("t-crawler", "game-list-banner"), userAgent = DecisionClient.CRAWLER_UA)
            crawler.placement("t-crawler")["ad"].isNull shouldBe true
            crawler.body.toString().contains("impressionToken") shouldBe false
            stats.calls() shouldBe emptyMap()

            // 같은 요청을 사람이 보내면 명령이 잡힌다 — 계측기가 살아 있다는 대조군
            stats.reset()
            client.decide(listOf("t-crawler", "game-list-banner")).placement("t-crawler")["ad"].isNull shouldBe false
            val human = stats.calls()
            human["mget"] shouldBe 1L
            human shouldContainKey "hincrby"
            (human.keys - setOf("mget", "evalsha", "eval", "hincrby", "expire")).shouldBeEmpty()
            ((human["evalsha"] ?: 0L) + (human["eval"] ?: 0L)) shouldBe 1L
        }
    }

    given("결정 경로의 DB 접근") {
        then("결정을 여러 번 불러도 ads_db 에 SELECT·INSERT·UPDATE·DELETE 가 0 이다 — 인덱스 갱신은 대조군으로 SELECT 를 낸다") {
            paidSetup("t-nodb", memberId = 5009)
            refreshIndex.refresh()

            val before = comStatus()
            repeat(3) { client.decide(listOf("t-nodb", "mystery-slot")).status shouldBe 200 }
            val after = comStatus()
            after.keys.forEach { (after.getValue(it) - before.getValue(it)) shouldBe 0L }

            refreshIndex.refresh()
            (comStatus().getValue("Com_select") - after.getValue("Com_select")) shouldBeGreaterThan 0
        }
    }

    // 컨테이너를 멈추므로 맨 끝에 둔다.
    given("ads Redis 가 응답하지 않으면") {
        then("200 으로 redis_unavailable 을 1초 안에 주고 HOUSE 는 그대로 준다") {
            paidSetup("t-redis-down", memberId = 5010)
            refreshIndex.refresh()
            client.decide(listOf("t-redis-down")).placement("t-redis-down")["ad"].isNull shouldBe false

            AdsTestContainers.pauseRedis()
            try {
                val response = client.decide(listOf("t-redis-down", "game-list-banner"))
                response.status shouldBe 200
                response.placement("t-redis-down")["reason"].asString() shouldBe "redis_unavailable"
                response.placement("t-redis-down")["ad"].isNull shouldBe true
                response.placement("game-list-banner")["house"] shouldHaveSize 3
                response.elapsed.toMillis() shouldBeLessThanOrEqual 1_000L
                response.elapsed shouldNotBe Duration.ZERO
            } finally {
                AdsTestContainers.unpauseRedis()
            }
        }
    }
})
