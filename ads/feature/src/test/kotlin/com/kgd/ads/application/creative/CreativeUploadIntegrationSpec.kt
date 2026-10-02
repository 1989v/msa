package com.kgd.ads.application.creative

import com.kgd.ads.support.AdsApiClient
import com.kgd.ads.support.AdsApiClient.As
import com.kgd.ads.support.AdsApiClient.FilePart
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.CountingImageTranscoder
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.EventClient
import com.kgd.ads.support.TestImages
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import java.security.MessageDigest
import javax.sql.DataSource

/**
 * 소재 이미지 업로드 — 매직 바이트 → 헤더 가로·세로 → 크기 → 지면 비율 → 재인코딩 → 내용 해시.
 * 판정 근거: HTTP 상태, 저장된 `ad_creative`·`ad_creative_asset` 행, 운영 디코더의 호출 수(감싼 계측기).
 * 거절된 업로드는 소재 행이 생기지 않고, 헤더 단계에서 거절된 것은 디코더가 한 번도 불리지 않아야 한다.
 */
@EnabledIf(DockerAvailable::class)
class CreativeUploadIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired decoder: CountingImageTranscoder,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val port = env.getRequiredProperty("local.server.port").toInt()
    val api = AdsApiClient(port)
    val assets = EventClient(port)
    val member = As(11_101)

    fixtures.placement("a-upload", ratios = "1.91:1")
    val advertiserId = fixtures.memberAdvertiser(11_101)
    val campaignId = fixtures.paidCampaign(advertiserId, listOf("a-upload"))

    fun creativeCount(): Long =
        jdbc.queryForObject("SELECT COUNT(*) FROM ad_creative WHERE campaign_id = ?", Long::class.java, campaignId)!!

    fun upload(file: FilePart, landingUrl: String = "https://example.com/fall-sale") =
        api.multipart(
            "POST", "/api/v1/ads/advertiser/campaigns/$campaignId/creatives", member,
            mapOf("title" to "가을 세일", "body" to "지금 확인하세요", "landingUrl" to landingUrl), file,
        )

    /** 거절 사례 공통: 400, 소재 행 없음, 디코더 호출 없음. */
    fun rejectedBeforeDecoding(file: FilePart) {
        val creativesBefore = creativeCount()
        val decodedBefore = decoder.count
        upload(file).status shouldBe 400
        creativeCount() shouldBe creativesBefore
        decoder.count shouldBe decodedBefore
    }

    given("규격에 맞는 PNG (메타데이터 청크 포함)") {
        then("심사 대기 소재가 되고, 저장본은 다시 인코딩돼 메타데이터가 없으며 주소는 저장본의 해시다") {
            val decodedBefore = decoder.count
            val response = upload(FilePart("banner.png", "image/png", TestImages.png(1200, 628, withMetadata = true)))

            response.status shouldBe 200
            response.data["status"].asString() shouldBe "PENDING"
            decoder.count shouldBe decodedBefore + 1

            val creativeId = response.data["id"].asLong()
            val hash = jdbc.queryForObject("SELECT image_hash FROM ad_creative WHERE id = ?", String::class.java, creativeId)!!
            val (contentType, stored) = jdbc.queryForObject(
                "SELECT content_type, bytes FROM ad_creative_asset WHERE hash = ?",
                { rs, _ -> rs.getString(1) to rs.getBytes(2) }, hash,
            )!!
            contentType shouldBe "image/png"
            String(stored, Charsets.ISO_8859_1) shouldNotContain TestImages.METADATA_KEYWORD
            MessageDigest.getInstance("SHA-256").digest(stored).joinToString("") { "%02x".format(it) } shouldBe hash
        }
    }

    given("확장자를 .png 로 단 JPEG") {
        then("형식은 파일 앞 바이트로 정해져 JPEG 으로 저장된다") {
            val response = upload(FilePart("photo.png", "image/png", TestImages.jpeg(1200, 628)))
            response.status shouldBe 200
            val hash = jdbc.queryForObject("SELECT image_hash FROM ad_creative WHERE id = ?", String::class.java, response.data["id"].asLong())!!
            jdbc.queryForObject("SELECT content_type FROM ad_creative_asset WHERE hash = ?", String::class.java, hash) shouldBe "image/jpeg"
        }
    }

    given("헤더 단계에서 거절되는 파일") {
        then("확장자만 .png 인 GIF") {
            rejectedBeforeDecoding(FilePart("banner.png", "image/png", TestImages.GIF))
        }
        then("300KB 안에 든 20000×20000 PNG — 디코더를 부르지 않고 거절한다") {
            val bomb = TestImages.pngBomb()
            bomb.size shouldBeLessThan 300 * 1024
            rejectedBeforeDecoding(FilePart("bomb.png", "image/png", bomb))
        }
        then("지면 비율(1.91:1)에 맞는 20000×10471 PNG — 비율 검사를 통과하므로 가로·세로 검사만이 막는다") {
            val bomb = TestImages.pngBomb(width = 20_000, height = 10_471)
            bomb.size shouldBeLessThan 300 * 1024
            rejectedBeforeDecoding(FilePart("wide-bomb.png", "image/png", bomb))
        }
        then("가로 2001px") {
            rejectedBeforeDecoding(FilePart("wide.png", "image/png", TestImages.png(2001, 1048)))
        }
        then("300KB + 1 바이트") {
            rejectedBeforeDecoding(FilePart("big.png", "image/png", TestImages.padTo(TestImages.png(1200, 628), 300 * 1024 + 1)))
        }
        then("지면 비율(1.91:1)에 맞지 않는 1000×1000") {
            rejectedBeforeDecoding(FilePart("square.png", "image/png", TestImages.png(1000, 1000)))
        }
    }

    given("두 형태를 받는 지면의 띠배너 캠페인") {
        fixtures.placement("a-upload-dual", formats = listOf(AdsFixtures.CARD, AdsFixtures.BANNER))
        val stripAdvertiser = fixtures.memberAdvertiser(11_102)
        val stripCampaign = fixtures.paidCampaign(stripAdvertiser, listOf("a-upload-dual"), bidMicros = 60_000, format = "BANNER")
        val stripMember = As(11_102)
        fun uploadStrip(file: FilePart) = api.multipart(
            "POST", "/api/v1/ads/advertiser/campaigns/$stripCampaign/creatives", stripMember,
            mapOf("title" to "가을 세일 띠배너", "landingUrl" to "https://example.com/strip"), file,
        )
        fun stripCount(): Long = jdbc.queryForObject("SELECT COUNT(*) FROM ad_creative WHERE campaign_id = ?", Long::class.java, stripCampaign)!!

        then("6.4:1 은 받아 설명 없이 저장한다") {
            val response = uploadStrip(FilePart("strip.png", "image/png", TestImages.png(1280, 200)))
            response.status shouldBe 200
            jdbc.queryForObject("SELECT body FROM ad_creative WHERE id = ?", String::class.java, response.data["id"].asLong()) shouldBe ""
        }
        then("카드 비율(1.91:1)과 6.4:1 헤더 폭탄(20000×3125)은 디코딩 전에 거절한다") {
            listOf(
                FilePart("card.png", "image/png", TestImages.png(1200, 628, shade = 31)),
                FilePart("strip-bomb.png", "image/png", TestImages.pngBomb(width = 20_000, height = 3_125)),
            ).forEach { file ->
                val before = stripCount()
                val decodedBefore = decoder.count
                uploadStrip(file).status shouldBe 400
                stripCount() shouldBe before
                decoder.count shouldBe decodedBefore
            }
        }
    }

    given("랜딩 URL 규칙") {
        then("https 가 아니거나 userinfo 가 있으면 400, 소재 행 없음") {
            val before = creativeCount()
            upload(FilePart("b.png", "image/png", TestImages.png(1200, 628)), landingUrl = "http://example.com").status shouldBe 400
            upload(FilePart("b.png", "image/png", TestImages.png(1200, 628)), landingUrl = "https://user@example.com").status shouldBe 400
            creativeCount() shouldBe before
        }
    }

    given("심사 전 소재의 이미지") {
        then("공개 에셋 경로는 404, 광고주 본인 미리보기는 200 — 승인 뒤에야 공개 경로가 낸다") {
            val response = upload(FilePart("banner.png", "image/png", TestImages.png(1200, 628, shade = 111)))
            val creativeId = response.data["id"].asLong()
            val hash = jdbc.queryForObject("SELECT image_hash FROM ad_creative WHERE id = ?", String::class.java, creativeId)!!

            assets.asset(hash).statusCode() shouldBe 404
            val preview = api.get("/api/v1/ads/advertiser/creatives/$creativeId/image", member)
            preview.status shouldBe 200
            preview.headers.firstValue("Cache-Control").orElse(null) shouldBe "no-store"

            fixtures.approve(creativeId)
            assets.asset(hash).statusCode() shouldBe 200
        }
    }

    given("반려된 소재를 보관하면") {
        then("반려 사유가 지워지고 그 캠페인의 소재 목록이 보관 행을 읽는다(500 없음)") {
            val archiveCampaignId = fixtures.paidCampaign(advertiserId, listOf("a-upload"))
            val creativeId = api.multipart(
                "POST", "/api/v1/ads/advertiser/campaigns/$archiveCampaignId/creatives", member,
                mapOf("title" to "반려될 소재", "body" to "지금 확인하세요", "landingUrl" to "https://example.com/rejected"),
                FilePart("rejected.png", "image/png", TestImages.png(1200, 628, shade = 112)),
            ).data["id"].asLong()
            fixtures.reject(creativeId)

            api.delete("/api/v1/ads/advertiser/creatives/$creativeId", member).status shouldBe 200
            jdbc.queryForMap("SELECT status, reject_reason FROM ad_creative WHERE id = ?", creativeId).let {
                it["status"] shouldBe "ARCHIVED"
                it["reject_reason"] shouldBe null
            }
            api.get("/api/v1/ads/advertiser/campaigns/$archiveCampaignId/creatives", member).status shouldBe 200
        }
    }
})
