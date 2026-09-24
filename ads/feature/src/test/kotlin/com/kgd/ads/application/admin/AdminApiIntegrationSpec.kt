package com.kgd.ads.application.admin

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.presentation.admin.dto.ContextMappingRequest
import com.kgd.ads.presentation.admin.dto.CreatePlacementRequest
import com.kgd.ads.presentation.admin.dto.HouseCampaignRequest
import com.kgd.ads.presentation.advertiser.dto.CampaignRequest
import com.kgd.ads.presentation.advertiser.dto.RegisterAdvertiserRequest
import com.kgd.ads.presentation.advertiser.dto.TopUpRequest
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.placement.model.PlacementFormat
import com.kgd.ads.support.AdsApiClient
import com.kgd.ads.support.AdsApiClient.As
import com.kgd.ads.support.AdsApiClient.FilePart
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.DecisionClient
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.EventClient
import com.kgd.ads.support.TestImages
import com.kgd.ads.support.items
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import java.time.LocalDateTime
import javax.sql.DataSource

/**
 * 어드민 API — 심사·광고주 정지·지면·문맥 매핑·HOUSE·원장 검사, 그리고 그 변경이 다음 인덱스 갱신에 결정으로 나가는지.
 * 판정 근거: HTTP 응답, 대상 행, `ad_admin_action`(행위자·시각), 결정 API 가 실제로 내준 광고.
 * 운영자(행위자)는 회원 11299.
 */
@EnabledIf(DockerAvailable::class)
class AdminApiIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired refreshIndex: RefreshCandidateIndexUseCase,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val port = env.getRequiredProperty("local.server.port").toInt()
    val api = AdsApiClient(port)
    val decisions = DecisionClient(port)
    val assets = EventClient(port)
    val admin = As(11_299, admin = true)
    val advertiser = As(11_201)

    fun audit(action: String, targetId: String): List<Long> =
        jdbc.queryForList(
            "SELECT actor_member_id FROM ad_admin_action WHERE action = ? AND target_id = ?", Long::class.java, action, targetId,
        )

    fun createPlacement(key: String, paidAllowed: Boolean = true, format: PlacementFormat = PlacementFormat.CARD) =
        api.post(
            "/api/v1/admin/ads/placements", admin,
            CreatePlacementRequest(key, "blog.1989v.com", format, listOf("1.91:1"), 100_000, true, paidAllowed, "어드민 스펙 지면"),
        )

    fun servedCreative(placement: String, visitor: String): Long? =
        decisions.decide(listOf(placement), visitorId = visitor).placement(placement)["ad"]
            ?.takeUnless { it.isNull }?.get("creativeId")?.asLong()

    given("운영자 신원") {
        then("X-User-Id 가 없으면 401, ROLE_ADMIN 이 없으면 403") {
            api.get("/api/v1/admin/ads/advertisers", null).status shouldBe 401
            api.get("/api/v1/admin/ads/advertisers", As(11_298)).status shouldBe 403
            api.get("/api/v1/admin/ads/advertisers", admin).status shouldBe 200
        }
    }

    given("광고주가 올린 소재의 심사") {
        createPlacement("a-adm").status shouldBe 200
        api.post("/api/v1/ads/advertiser/register", advertiser, RegisterAdvertiserRequest("심사 광고주"))
        api.post("/api/v1/ads/advertiser/top-ups", advertiser, TopUpRequest(50_000_000, "adm-topup"))
        val campaignId = api.post(
            "/api/v1/ads/advertiser/campaigns", advertiser,
            CampaignRequest("심사 캠페인", BidType.CPM, 200_000, 5_000_000, null, LocalDateTime.of(2026, 9, 1, 0, 0), null, null, listOf("a-adm")),
        ).data["id"].asLong()
        api.put("/api/v1/ads/advertiser/campaigns/$campaignId/status", advertiser, mapOf("action" to "START")).status shouldBe 200
        val submitted = api.multipart(
            "POST", "/api/v1/ads/advertiser/campaigns/$campaignId/creatives", advertiser,
            mapOf("title" to "심사 받을 소재", "body" to "문구", "landingUrl" to "https://example.com/review"),
            FilePart("r.png", "image/png", TestImages.png(1200, 628, shade = 201)),
        )
        val creativeId = submitted.data["id"].asLong()
        val hash = jdbc.queryForObject("SELECT image_hash FROM ad_creative WHERE id = ?", String::class.java, creativeId)!!

        then("심사 큐에 있고, 운영자는 이미지를 미리 볼 수 있지만 공개 경로는 404 다") {
            api.get("/api/v1/admin/ads/creatives/pending", admin).data.items().map { it["id"].asLong() } shouldContain creativeId
            api.get("/api/v1/admin/ads/creatives/$creativeId/image", admin).status shouldBe 200
            assets.asset(hash).statusCode() shouldBe 404
        }
        then("반려하면 광고주가 반려 사유 코드를 본다 — 행위자가 남는다") {
            api.post("/api/v1/admin/ads/creatives/$creativeId/reject", admin, mapOf("reason" to "LANDING_MISMATCH")).status shouldBe 200
            val seen = api.get("/api/v1/ads/advertiser/creatives/$creativeId", advertiser).data
            seen["status"].asString() shouldBe "REJECTED"
            seen["rejectReason"].asString() shouldBe "LANDING_MISMATCH"
            audit("CREATIVE_REJECT", creativeId.toString()) shouldBe listOf(11_299L)
            jdbc.queryForObject("SELECT reviewed_by FROM ad_creative WHERE id = ?", Long::class.java, creativeId) shouldBe 11_299L
        }
        then("사유 코드 없이 반려할 수 없다") {
            api.post("/api/v1/admin/ads/creatives/$creativeId/reject", admin, mapOf("reason" to "NOT_A_REASON")).status shouldBe 400
        }
        then("고쳐 다시 올리면 심사 대기, 승인하면 다음 인덱스 갱신에서 게재되고 공개 에셋도 열린다") {
            api.multipart(
                "PUT", "/api/v1/ads/advertiser/creatives/$creativeId", advertiser,
                mapOf("title" to "고친 소재", "body" to "고친 문구", "landingUrl" to "https://example.com/review"), null,
            ).data["status"].asString() shouldBe "PENDING"

            refreshIndex.refresh()
            servedCreative("a-adm", "vid-adm-1") shouldBe null

            api.post("/api/v1/admin/ads/creatives/$creativeId/approve", admin).status shouldBe 200
            audit("CREATIVE_APPROVE", creativeId.toString()) shouldBe listOf(11_299L)
            servedCreative("a-adm", "vid-adm-2") shouldBe null // 갱신 전에는 아직 없다
            refreshIndex.refresh()
            servedCreative("a-adm", "vid-adm-3") shouldBe creativeId
            assets.asset(hash).statusCode() shouldBe 200
        }
        then("광고주를 정지하면 다음 갱신에서 빠지고 쓰기가 막힌다 — 해제하면 돌아온다") {
            val advertiserId = jdbc.queryForObject("SELECT id FROM ad_advertiser WHERE member_id = 11201", Long::class.java)!!
            api.post("/api/v1/admin/ads/advertisers/$advertiserId/suspend", admin, mapOf("reason" to "허위 광고 신고")).status shouldBe 200
            audit("ADVERTISER_SUSPEND", advertiserId.toString()) shouldBe listOf(11_299L)
            val listed = api.get("/api/v1/admin/ads/advertisers", admin).data.items().first { it["id"].asLong() == advertiserId }
            listed["status"].asString() shouldBe "SUSPENDED"
            listed["suspendReason"].asString() shouldBe "허위 광고 신고"
            listed["suspendedBy"].asLong() shouldBe 11_299L

            refreshIndex.refresh()
            servedCreative("a-adm", "vid-adm-4") shouldBe null
            api.get("/api/v1/ads/advertiser/me", advertiser).status shouldBe 200
            api.put("/api/v1/ads/advertiser/campaigns/$campaignId/status", advertiser, mapOf("action" to "PAUSE")).status shouldBe 403

            api.post("/api/v1/admin/ads/advertisers/$advertiserId/unsuspend", admin).status shouldBe 200
            audit("ADVERTISER_UNSUSPEND", advertiserId.toString()) shouldBe listOf(11_299L)
            refreshIndex.refresh()
            servedCreative("a-adm", "vid-adm-5") shouldBe creativeId
        }
    }

    given("지면 등록부") {
        then("등록·수정이 반영되고 변경마다 행위자가 남는다 — 유료를 끈 지면은 광고주가 고를 수 없다") {
            createPlacement("a-adm-new").status shouldBe 200
            createPlacement("a-adm-new").status shouldBe 400 // 같은 키
            api.patch("/api/v1/admin/ads/placements/a-adm-new", admin, mapOf("floorMicros" to 150_000, "paidAllowed" to false)).status shouldBe 200
            val listed = api.get("/api/v1/admin/ads/placements", admin).data.items().first { it["key"].asString() == "a-adm-new" }
            listed["floorMicros"].asLong() shouldBe 150_000L
            listed["paidAllowed"].asBoolean() shouldBe false
            audit("PLACEMENT_CREATE", "a-adm-new") shouldBe listOf(11_299L)
            audit("PLACEMENT_UPDATE", "a-adm-new") shouldBe listOf(11_299L)

            api.post(
                "/api/v1/ads/advertiser/campaigns", advertiser,
                CampaignRequest("막힌 지면", BidType.CPM, 200_000, 5_000_000, null, LocalDateTime.of(2026, 9, 1, 0, 0), null, null, listOf("a-adm-new")),
            ).status shouldBe 400
        }
        then("최저가 하한(1,000) 아래는 거절") {
            api.patch("/api/v1/admin/ads/placements/a-adm-new", admin, mapOf("floorMicros" to 999)).status shouldBe 400
        }
        then("미등록 지면 키 목록을 요청 수와 함께 준다") {
            jdbc.update(
                "INSERT INTO ad_unregistered_placement (placement_key, requests, first_seen_at, last_seen_at) VALUES ('a-adm-unknown', 7, ?, ?)",
                LocalDateTime.of(2027, 1, 2, 3, 0), LocalDateTime.of(2027, 1, 2, 4, 0),
            )
            val row = api.get("/api/v1/admin/ads/placements/unregistered", admin).data.items().first { it["placementKey"].asString() == "a-adm-unknown" }
            row["requests"].asLong() shouldBe 7L
        }
    }

    given("문맥 매핑") {
        then("넣고·바꾸고·지우며 행위자를 남긴다 — 없는 카테고리는 거절") {
            api.put("/api/v1/admin/ads/context-mappings", admin, ContextMappingRequest("blog:adm-spec", "TECH")).status shouldBe 200
            api.put("/api/v1/admin/ads/context-mappings", admin, ContextMappingRequest("blog:adm-spec", "GAME")).status shouldBe 200
            val row = api.get("/api/v1/admin/ads/context-mappings", admin).data.items().first { it["contextKey"].asString() == "blog:adm-spec" }
            row["categoryCode"].asString() shouldBe "GAME"
            row["updatedBy"].asLong() shouldBe 11_299L
            api.put("/api/v1/admin/ads/context-mappings", admin, ContextMappingRequest("blog:adm-spec", "NOPE")).status shouldBe 400

            api.delete("/api/v1/admin/ads/context-mappings?contextKey=blog:adm-spec", admin).status shouldBe 200
            api.get("/api/v1/admin/ads/context-mappings", admin).data.items().map { it["contextKey"].asString() } shouldNotContain "blog:adm-spec"
            audit("CONTEXT_MAPPING_PUT", "blog:adm-spec") shouldBe listOf(11_299L, 11_299L)
            audit("CONTEXT_MAPPING_DELETE", "blog:adm-spec") shouldBe listOf(11_299L)
        }
    }

    given("HOUSE 캠페인·소재") {
        then("운영자가 만든 HOUSE 소재는 승인 상태로 시작하고, 시작 뒤 다음 갱신에서 그 지면의 HOUSE 목록에 나온다") {
            createPlacement("a-adm-house", paidAllowed = false, format = PlacementFormat.BANNER).status shouldBe 200
            val campaign = api.post(
                "/api/v1/admin/ads/house/campaigns", admin,
                HouseCampaignRequest("어드민 스펙 홍보", LocalDateTime.of(2026, 9, 1, 0, 0), null, listOf("a-adm-house")),
            )
            campaign.status shouldBe 200
            val campaignId = campaign.data["id"].asLong()
            jdbc.queryForObject(
                "SELECT a.kind FROM ad_campaign c JOIN ad_advertiser a ON a.id = c.advertiser_id WHERE c.id = ?", String::class.java, campaignId,
            ) shouldBe "SYSTEM"

            val creative = api.multipart(
                "POST", "/api/v1/admin/ads/house/campaigns/$campaignId/creatives", admin,
                mapOf("title" to "새 게임 나왔어요", "body" to "지금 해 보기", "link" to "/games", "emoji" to "🎮"), null,
            )
            creative.status shouldBe 200
            creative.data["status"].asString() shouldBe "APPROVED"
            api.multipart(
                "POST", "/api/v1/admin/ads/house/campaigns/$campaignId/creatives", admin,
                mapOf("title" to "밖으로", "body" to "다른 호스트", "link" to "//evil.example"), null,
            ).status shouldBe 400

            api.put("/api/v1/admin/ads/house/campaigns/$campaignId/status", admin, mapOf("action" to "START")).status shouldBe 200
            audit("HOUSE_CAMPAIGN_CREATE", campaignId.toString()) shouldBe listOf(11_299L)
            audit("HOUSE_CAMPAIGN_START", campaignId.toString()) shouldBe listOf(11_299L)

            refreshIndex.refresh()
            val house = decisions.decide(listOf("a-adm-house"), visitorId = "vid-adm-house").placement("a-adm-house")["house"]
            house.items().map { it["title"].asString() } shouldContain "새 게임 나왔어요"
        }
    }

    given("원장 검사") {
        then("지금 돌린 분개 합을 준다 — 원장 표의 합과 같다") {
            val result = api.get("/api/v1/admin/ads/ledger/check", admin).data
            val sum = jdbc.queryForObject("SELECT COALESCE(SUM(amount_micros), 0) FROM ad_ledger_entry", Long::class.java)!!
            result["imbalanceMicros"].asLong() shouldBe sum
            result["balanced"].asBoolean() shouldBe (sum == 0L)
        }
    }
})
