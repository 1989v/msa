package com.kgd.ads.application.advertiser

import com.kgd.ads.application.advertiser.usecase.RegisterAdvertiserUseCase
import com.kgd.ads.application.ledger.config.AdsTopUpProperties
import com.kgd.ads.domain.ledger.model.Credits
import com.kgd.ads.presentation.admin.dto.HouseCampaignRequest
import com.kgd.ads.presentation.advertiser.dto.CampaignRequest
import com.kgd.ads.presentation.advertiser.dto.RegisterAdvertiserRequest
import com.kgd.ads.presentation.advertiser.dto.TopUpRequest
import com.kgd.ads.support.AdsApiClient
import com.kgd.ads.support.AdsApiClient.As
import com.kgd.ads.support.AdsApiClient.FilePart
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.NOON_HALF
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.MutableClock
import com.kgd.ads.support.TestImages
import com.kgd.ads.support.items
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import java.io.File
import java.time.Clock
import java.time.LocalDateTime
import javax.sql.DataSource
import kotlin.reflect.full.memberProperties

/**
 * 광고주 API — 등록·소유 범위·저장 불변식·상태 전이·충전 멱등 키·카탈로그·정지.
 * 판정 근거: HTTP 상태와 응답 값, 그리고 `ad_advertiser`·`ad_campaign`·`ad_ledger_transaction` 행.
 * 요청 모델에 우선순위·심사 상태·원장 계정이 없다는 것은 요청 DTO 클래스의 속성으로 확인한다.
 */
@EnabledIf(DockerAvailable::class)
class AdvertiserApiIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired @Qualifier("adsClock") clock: Clock,
    @Autowired topUpLimits: AdsTopUpProperties,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val api = AdsApiClient(env.getRequiredProperty("local.server.port").toInt())
    val mutableClock = clock as MutableClock

    afterSpec { mutableClock.set(NOON_HALF) }

    fun register(memberId: Long): Long {
        val response = api.post("/api/v1/ads/advertiser/register", As(memberId), RegisterAdvertiserRequest("광고주$memberId"))
        response.status shouldBe 200
        return response.data["advertiserId"].asLong()
    }

    fun campaignRequest(
        placements: List<String>,
        bidMicros: Long = 200_000,
        dailyBudgetMicros: Long = 5_000_000,
    ) = CampaignRequest(
        name = "가을 캠페인",
        bidType = com.kgd.ads.domain.campaign.model.BidType.CPM,
        bidMicros = bidMicros,
        dailyBudgetMicros = dailyBudgetMicros,
        startAt = LocalDateTime.of(2026, 9, 1, 0, 0),
        placementKeys = placements,
    )

    fun createCampaign(memberId: Long, placements: List<String>): Long {
        val response = api.post("/api/v1/ads/advertiser/campaigns", As(memberId), campaignRequest(placements))
        response.status shouldBe 200
        return response.data["id"].asLong()
    }

    fun status(campaignId: Long, memberId: Long, action: String) =
        api.put("/api/v1/ads/advertiser/campaigns/$campaignId/status", As(memberId), mapOf("action" to action))

    given("광고주 등록") {
        then("두 번 불러도 ad_advertiser 행은 하나이고 같은 광고주 id 를 돌려준다 — 지갑이 함께 생긴다") {
            val first = register(11_001)
            register(11_001) shouldBe first
            jdbc.queryForObject("SELECT COUNT(*) FROM ad_advertiser WHERE member_id = 11001", Long::class.java) shouldBe 1L
            jdbc.queryForObject("SELECT kind FROM ad_advertiser WHERE id = ?", String::class.java, first) shouldBe "MEMBER"
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM ad_ledger_account WHERE advertiser_id = ? AND type = 'ADVERTISER_WALLET'", Long::class.java, first,
            ) shouldBe 1L
        }
        then("ads 에는 회원·인증 서비스를 가리키는 코드가 없다 — 등록은 전역 Role 을 바꿀 수 없다") {
            // 컴파일된 ads 메인 클래스 전부의 상수 풀에서 다른 서비스의 패키지 참조를 찾는다.
            val root = File(RegisterAdvertiserUseCase::class.java.protectionDomain.codeSource.location.toURI())
            root.isDirectory shouldBe true
            val classes = root.walkTopDown().filter { it.isFile && it.extension == "class" }.toList()
            classes.size shouldBeGreaterThan 50
            val referencing = classes.filter { f ->
                val text = String(f.readBytes(), Charsets.ISO_8859_1)
                "com/kgd/member" in text || "com/kgd/auth" in text
            }.map { it.name }
            referencing.shouldBeEmpty()
            val suspiciousPorts = classes
                .map { it.relativeTo(root).path.replace(File.separatorChar, '/') }
                .filter { "/port/" in it && Regex("(?i)(member|auth|role)").containsMatchIn(it.substringAfterLast('/')) }
            suspiciousPorts.shouldBeEmpty()
        }
        then("X-User-Id 가 없으면 401") {
            api.post("/api/v1/ads/advertiser/register", null, RegisterAdvertiserRequest("익명")).status shouldBe 401
            api.get("/api/v1/ads/advertiser/me", null).status shouldBe 401
        }
    }

    given("요청 모델") {
        then("우선순위·심사 상태·원장 계정 필드가 없다") {
            val forbidden = Regex("(?i)(priority|status|review|ledger|account|advertiser)")
            listOf(CampaignRequest::class, TopUpRequest::class, RegisterAdvertiserRequest::class).forEach { type ->
                type.memberProperties.map { it.name }.filter { forbidden.containsMatchIn(it) }.shouldBeEmpty()
            }
        }
        then("본문에 실어 보내도 무시된다 — 만든 캠페인은 DRAFT 이고 소유자는 요청 회원의 MEMBER 광고주(PAID)다") {
            fixtures.placement("a-api-extra")
            val advertiserId = register(11_002)
            val raw = """
                {"name":"우회 시도","bidType":"CPM","bidMicros":200000,"dailyBudgetMicros":5000000,
                 "startAt":"2026-09-01T00:00:00","placementKeys":["a-api-extra"],
                 "priority":"HOUSE","status":"ACTIVE","reviewStatus":"APPROVED","advertiserId":1,"ledgerAccountId":1}
            """.trimIndent()
            val response = api.postRaw("/api/v1/ads/advertiser/campaigns", As(11_002), raw)
            response.status shouldBe 200
            response.data["status"].asString() shouldBe "DRAFT"
            val (owner, kind) = jdbc.queryForObject(
                "SELECT c.advertiser_id, a.kind FROM ad_campaign c JOIN ad_advertiser a ON a.id = c.advertiser_id WHERE c.id = ?",
                { rs, _ -> rs.getLong(1) to rs.getString(2) }, response.data["id"].asLong(),
            )!!
            owner shouldBe advertiserId
            kind shouldBe "MEMBER"
        }
        then("HOUSE 전용 지면을 고르면 거절된다 — 광고주 API 로는 HOUSE 를 만들 수 없다") {
            fixtures.placement("a-api-houseonly", paidAllowed = false)
            register(11_003)
            api.post("/api/v1/ads/advertiser/campaigns", As(11_003), campaignRequest(listOf("a-api-houseonly"))).status shouldBe 400
            // HOUSE 요청 모양을 광고주 경로에 보내도 유료 캠페인 요청으로만 읽힌다(입찰 없음 → 400).
            api.post(
                "/api/v1/ads/advertiser/campaigns", As(11_003),
                HouseCampaignRequest("하우스", LocalDateTime.of(2026, 9, 1, 0, 0), null, listOf("a-api-houseonly")),
            ).status shouldBe 400
        }
    }

    given("남의 캠페인·소재") {
        fixtures.placement("a-api-own")
        register(11_010)
        register(11_011)
        val campaignId = createCampaign(11_010, listOf("a-api-own"))
        val creative = api.multipart(
            "POST", "/api/v1/ads/advertiser/campaigns/$campaignId/creatives", As(11_010),
            mapOf("title" to "내 소재", "body" to "내 문구", "landingUrl" to "https://example.com/mine"),
            FilePart("mine.png", "image/png", TestImages.png(1200, 628, shade = 12)),
        )
        val creativeId = creative.data["id"].asLong()
        val other = As(11_011)

        then("주인에게는 보인다") {
            api.get("/api/v1/ads/advertiser/campaigns/$campaignId", As(11_010)).status shouldBe 200
            api.get("/api/v1/ads/advertiser/creatives/$creativeId", As(11_010)).status shouldBe 200
        }
        then("다른 광고주의 조회·수정·전이·소재 올리기는 전부 404 이고 아무것도 바뀌지 않는다") {
            api.get("/api/v1/ads/advertiser/campaigns/$campaignId", other).status shouldBe 404
            api.put("/api/v1/ads/advertiser/campaigns/$campaignId", other, campaignRequest(listOf("a-api-own"))).status shouldBe 404
            status(campaignId, 11_011, "START").status shouldBe 404
            api.get("/api/v1/ads/advertiser/campaigns/$campaignId/creatives", other).status shouldBe 404
            api.multipart(
                "POST", "/api/v1/ads/advertiser/campaigns/$campaignId/creatives", other,
                mapOf("title" to "끼어들기", "body" to "남의 캠페인", "landingUrl" to "https://evil.example"),
                FilePart("x.png", "image/png", TestImages.png(1200, 628, shade = 13)),
            ).status shouldBe 404
            api.get("/api/v1/ads/advertiser/creatives/$creativeId", other).status shouldBe 404
            api.multipart(
                "PUT", "/api/v1/ads/advertiser/creatives/$creativeId", other,
                mapOf("title" to "바꿔치기", "body" to "남의 소재", "landingUrl" to "https://evil.example"), null,
            ).status shouldBe 404
            api.delete("/api/v1/ads/advertiser/creatives/$creativeId", other).status shouldBe 404
            api.get("/api/v1/ads/advertiser/creatives/$creativeId/image", other).status shouldBe 404

            jdbc.queryForObject("SELECT status FROM ad_campaign WHERE id = ?", String::class.java, campaignId) shouldBe "DRAFT"
            jdbc.queryForObject("SELECT title FROM ad_creative WHERE id = ?", String::class.java, creativeId) shouldBe "내 소재"
            jdbc.queryForObject("SELECT COUNT(*) FROM ad_creative WHERE campaign_id = ?", Long::class.java, campaignId) shouldBe 1L
        }
        then("목록에도 남의 것은 없다") {
            api.get("/api/v1/ads/advertiser/campaigns", other).data.items().map { it["id"].asLong() } shouldNotContain campaignId
        }
    }

    given("저장 불변식 — 저장·수정·시작마다 다시 확인") {
        fixtures.placement("a-api-floor", floorMicros = 300_000)
        fixtures.placement("a-api-cheap", floorMicros = 100_000)
        register(11_020)

        then("CPM 입찰가가 지면 최저가보다 낮으면 400") {
            api.post("/api/v1/ads/advertiser/campaigns", As(11_020), campaignRequest(listOf("a-api-floor"), bidMicros = 200_000)).status shouldBe 400
        }
        then("일예산이 1회 과금액보다 작으면 400") {
            api.post(
                "/api/v1/ads/advertiser/campaigns", As(11_020),
                campaignRequest(listOf("a-api-cheap"), bidMicros = 200_000, dailyBudgetMicros = 199),
            ).status shouldBe 400
        }
        then("수정도 같은 검사를 거친다") {
            val campaignId = createCampaign(11_020, listOf("a-api-cheap"))
            api.put(
                "/api/v1/ads/advertiser/campaigns/$campaignId", As(11_020), campaignRequest(listOf("a-api-floor"), bidMicros = 200_000),
            ).status shouldBe 400
            api.put(
                "/api/v1/ads/advertiser/campaigns/$campaignId", As(11_020), campaignRequest(listOf("a-api-cheap"), bidMicros = 250_000),
            ).data["bidMicros"].asLong() shouldBe 250_000L
        }
        then("저장 뒤 최저가가 올랐으면 시작이 거절되고, 멈추는 전이는 언제나 된다 — 종료는 되돌릴 수 없다") {
            fixtures.placement("a-api-raise", floorMicros = 100_000)
            val campaignId = createCampaign(11_020, listOf("a-api-raise"))
            jdbc.update("UPDATE ad_placement SET floor_micros = 500000 WHERE placement_key = 'a-api-raise'")
            status(campaignId, 11_020, "START").status shouldBe 400
            jdbc.update("UPDATE ad_placement SET floor_micros = 100000 WHERE placement_key = 'a-api-raise'")
            status(campaignId, 11_020, "START").data["status"].asString() shouldBe "ACTIVE"

            jdbc.update("UPDATE ad_placement SET floor_micros = 500000 WHERE placement_key = 'a-api-raise'")
            status(campaignId, 11_020, "PAUSE").data["status"].asString() shouldBe "PAUSED"
            status(campaignId, 11_020, "RESUME").status shouldBe 400
            status(campaignId, 11_020, "END").data["status"].asString() shouldBe "ENDED"
            status(campaignId, 11_020, "START").status shouldBe 400
            api.put("/api/v1/ads/advertiser/campaigns/$campaignId", As(11_020), campaignRequest(listOf("a-api-cheap"))).status shouldBe 400
        }
    }

    given("충전 멱등 키") {
        register(11_030)
        register(11_031)
        fun topUp(memberId: Long, key: String) =
            api.post("/api/v1/ads/advertiser/top-ups", As(memberId), TopUpRequest(1_000_000, key))

        then("같은 회원의 같은 키는 같은 거래, 다른 회원이 같은 키를 보내면 별개 거래다") {
            val first = topUp(11_030, "same-key")
            first.status shouldBe 200
            topUp(11_030, "same-key").data["transactionId"].asLong() shouldBe first.data["transactionId"].asLong()

            val other = topUp(11_031, "same-key")
            other.status shouldBe 200
            other.data["transactionId"].asLong() shouldNotBe first.data["transactionId"].asLong()
            other.data["balanceMicros"].asLong() shouldBe 1_000_000L

            jdbc.queryForList("SELECT idempotency_key FROM ad_ledger_transaction WHERE idempotency_key LIKE '%same-key'", String::class.java)
                .toSet() shouldBe setOf("TOPUP:11030:same-key", "TOPUP:11031:same-key")
        }
        then("대시보드는 잔액과 오늘 지출·청구액을 준다") {
            val me = api.get("/api/v1/ads/advertiser/me", As(11_030)).data
            me["balanceMicros"].asLong() shouldBe 1_000_000L
            me["todaySpendMicros"].asLong() shouldBe 0L
            me["status"].asString() shouldBe "ACTIVE"
        }
    }

    given("거절 사유 — 광고주 경로는 도메인 문구를 응답에 싣는다") {
        fixtures.placement("a-api-msg-floor", floorMicros = 300_000)
        fixtures.placement("a-api-msg-house", paidAllowed = false)
        register(13_001)
        fun errorOf(response: AdsApiClient.Response) = response.body["error"]["message"].asString()

        then("CPM 입찰가가 최저가보다 낮으면 400 — 어느 지면의 최저가가 얼마인지 크레딧으로 알려 준다") {
            val response = api.post("/api/v1/ads/advertiser/campaigns", As(13_001), campaignRequest(listOf("a-api-msg-floor"), bidMicros = 200_000))
            response.status shouldBe 400
            response.body["error"]["code"].asString() shouldBe "INVALID_INPUT"
            errorOf(response) shouldBe "입찰가가 지면 a-api-msg-floor 의 최저가(0.3 크레딧)보다 낮습니다"
        }
        then("일예산이 1회 과금액보다 작으면 그 과금액을 알려 준다") {
            val response = api.post(
                "/api/v1/ads/advertiser/campaigns", As(13_001),
                campaignRequest(listOf("a-api-msg-floor"), bidMicros = 400_000, dailyBudgetMicros = 199),
            )
            response.status shouldBe 400
            errorOf(response) shouldBe "일예산은 1회 과금액(0.0004 크레딧) 이상이어야 합니다"
        }
        then("유료를 받지 않는 지면을 고르면 그 지면 이름이 온다") {
            val response = api.post("/api/v1/ads/advertiser/campaigns", As(13_001), campaignRequest(listOf("a-api-msg-house")))
            response.status shouldBe 400
            errorOf(response) shouldBe "지면 a-api-msg-house 는 유료 광고를 받지 않습니다"
        }
        then("1회 충전 상한을 넘으면 상한을 크레딧으로 알려 준다") {
            val response = api.post("/api/v1/ads/advertiser/top-ups", As(13_001), TopUpRequest(topUpLimits.maxPerCallMicros + 1, "msg-over"))
            response.status shouldBe 400
            errorOf(response) shouldBe "1회 충전 한도(${Credits.format(topUpLimits.maxPerCallMicros)})를 넘었습니다"
        }
        then("입력 검증 실패는 필드 이름과 한국어 사유다 — 보낸 값은 싣지 않는다") {
            val response = api.post("/api/v1/ads/advertiser/top-ups", As(13_001), TopUpRequest(1_000_000, "bad key!"))
            response.status shouldBe 400
            errorOf(response) shouldBe "idempotencyKey: 형식이 올바르지 않습니다"
        }
        then("신원이 없으면 상태 코드는 공용 판정 그대로 401 이다") {
            api.get("/api/v1/ads/advertiser/me", null).status shouldBe 401
        }
    }

    given("오늘 충전 여유 — 충전 한도 확인과 같은 KST 하루 합계") {
        register(13_010)
        fun topUp(micros: Long, key: String) = api.post("/api/v1/ads/advertiser/top-ups", As(13_010), TopUpRequest(micros, key))
        fun me() = api.get("/api/v1/ads/advertiser/me", As(13_010)).data

        then("대시보드의 오늘 충전 누계가 거절 문구의 누계와 같고, 자정(KST)이 지나면 0 이다") {
            mutableClock.set(LocalDateTime.of(2027, 3, 10, 23, 50))
            me()["todayTopUpMicros"].asLong() shouldBe 0L
            me()["dailyTopUpLimitMicros"].asLong() shouldBe topUpLimits.dailyLimitMicros
            me()["maxTopUpPerCallMicros"].asLong() shouldBe topUpLimits.maxPerCallMicros

            // 한도 바로 아래까지 채운 뒤 상한 1회를 더 보내 거절시킨다.
            val fills = (topUpLimits.dailyLimitMicros / topUpLimits.maxPerCallMicros - 1).toInt()
            repeat(fills) { topUp(topUpLimits.maxPerCallMicros, "day-fill-$it").status shouldBe 200 }
            topUp(3_000_000, "day-small").status shouldBe 200
            val toppedUp = topUpLimits.maxPerCallMicros * fills + 3_000_000
            me()["todayTopUpMicros"].asLong() shouldBe toppedUp

            val rejected = topUp(topUpLimits.maxPerCallMicros, "day-over")
            rejected.status shouldBe 400
            rejected.body["error"]["message"].asString() shouldBe
                "오늘 충전 한도(${Credits.format(topUpLimits.dailyLimitMicros)})를 넘습니다 — 오늘 충전 ${Credits.format(toppedUp)}"

            mutableClock.set(LocalDateTime.of(2027, 3, 11, 0, 10))
            me()["todayTopUpMicros"].asLong() shouldBe 0L
            topUp(topUpLimits.maxPerCallMicros, "day-next").status shouldBe 200
            me()["todayTopUpMicros"].asLong() shouldBe topUpLimits.maxPerCallMicros
            mutableClock.set(NOON_HALF)
        }
    }

    given("카탈로그") {
        then("유료를 받는 활성 지면만, 최근 7일(오늘 제외) 일평균 요청과 함께 — 카테고리 목록도 준다") {
            fixtures.placement("a-api-cat")
            fixtures.placement("a-api-cat-house", paidAllowed = false)
            register(11_040)
            mutableClock.set(LocalDateTime.of(2027, 1, 15, 10, 0))
            // 7일 창 안: 1/8~1/14 에 하루 한 시각씩 요청 100·200… / 창 밖: 1/7 과 오늘(1/15)
            (8..14).forEach { day ->
                jdbc.update(
                    "INSERT INTO ad_placement_hourly (placement_key, hour_kst, requests, paid_filled, updated_at) VALUES ('a-api-cat', ?, ?, 0, ?)",
                    LocalDateTime.of(2027, 1, day, 9, 0), 100L * (day - 7), LocalDateTime.of(2027, 1, 15, 0, 0),
                )
            }
            listOf(LocalDateTime.of(2027, 1, 7, 9, 0), LocalDateTime.of(2027, 1, 15, 9, 0)).forEach {
                jdbc.update(
                    "INSERT INTO ad_placement_hourly (placement_key, hour_kst, requests, paid_filled, updated_at) VALUES ('a-api-cat', ?, 99999, 0, ?)",
                    it, LocalDateTime.of(2027, 1, 15, 0, 0),
                )
            }

            val catalog = api.get("/api/v1/ads/advertiser/catalog", As(11_040)).data
            val keys = catalog["placements"].items().map { it["key"].asString() }
            keys shouldContain "a-api-cat"
            keys shouldNotContain "a-api-cat-house"
            catalog["placements"].items().first { it["key"].asString() == "a-api-cat" }["averageDailyRequests"].asLong() shouldBe (100L + 200 + 300 + 400 + 500 + 600 + 700) / 7
            catalog["categories"].items().map { it["code"].asString() } shouldContain "TECH"
            mutableClock.set(NOON_HALF)
        }
    }

    given("정지된 광고주") {
        then("조회는 되고 쓰기(캠페인·충전)는 403") {
            fixtures.placement("a-api-susp")
            val advertiserId = register(11_050)
            fixtures.suspend(advertiserId)
            val me = api.get("/api/v1/ads/advertiser/me", As(11_050))
            me.status shouldBe 200
            me.data["status"].asString() shouldBe "SUSPENDED"
            api.get("/api/v1/ads/advertiser/campaigns", As(11_050)).status shouldBe 200
            api.post("/api/v1/ads/advertiser/campaigns", As(11_050), campaignRequest(listOf("a-api-susp"))).status shouldBe 403
            api.post("/api/v1/ads/advertiser/top-ups", As(11_050), TopUpRequest(1_000_000, "susp")).status shouldBe 403
        }
    }
})
