package com.kgd.ads.application.decision

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.infrastructure.metrics.DecisionMetrics
import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.KST
import com.kgd.ads.support.AdsIntegrationTestApplication.Companion.NOON_HALF
import com.kgd.ads.support.DecisionClient
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.MutableClock
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import javax.sql.DataSource

/**
 * 후보 인덱스 갱신 — 심사·정지·반려는 DB 에 쓰인 순간이 아니라 **갱신을 부른 뒤**에 결정에 보인다.
 * 스케줄 작업은 꺼 두고 갱신을 직접 불러, 「갱신 전 = 옛 값 · 갱신 후 = 새 값」을 둘 다 본다.
 */
@EnabledIf(DockerAvailable::class)
class CandidateIndexIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
    @Autowired refreshIndex: RefreshCandidateIndexUseCase,
    @Autowired meterRegistry: MeterRegistry,
    @Autowired clock: MutableClock,
) : AdsIntegrationSpec({

    val fixtures = AdsFixtures(JdbcTemplate(adsDataSource))
    val client = DecisionClient(env.getRequiredProperty("local.server.port").toInt())
    fun hasAd(key: String): Boolean = !client.decide(listOf(key)).placement(key)["ad"].isNull

    given("심사 대기 소재") {
        then("승인을 DB 에 써도 갱신 전에는 안 나가고, 갱신하면 나간다") {
            fixtures.placement("i9-approve")
            val advertiserId = fixtures.memberAdvertiser(6001)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf("i9-approve"))
            val creativeId = fixtures.paidCreative(campaignId, advertiserId, status = "PENDING")
            refreshIndex.refresh()
            hasAd("i9-approve") shouldBe false

            fixtures.approve(creativeId)
            hasAd("i9-approve") shouldBe false
            refreshIndex.refresh()
            hasAd("i9-approve") shouldBe true
        }
    }

    given("게재 중인 광고주") {
        then("정지하면 갱신 뒤 그 광고주의 캠페인이 후보에서 빠진다") {
            fixtures.placement("i9-suspend")
            val advertiserId = fixtures.memberAdvertiser(6002)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf("i9-suspend"))
            fixtures.paidCreative(campaignId, advertiserId)
            refreshIndex.refresh()
            hasAd("i9-suspend") shouldBe true

            fixtures.suspend(advertiserId)
            hasAd("i9-suspend") shouldBe true
            refreshIndex.refresh()
            hasAd("i9-suspend") shouldBe false
        }
    }

    given("승인됐던 소재") {
        then("반려 상태가 되면 갱신 뒤 빠진다") {
            fixtures.placement("i9-reject")
            val advertiserId = fixtures.memberAdvertiser(6003)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf("i9-reject"))
            val creativeId = fixtures.paidCreative(campaignId, advertiserId)
            refreshIndex.refresh()
            hasAd("i9-reject") shouldBe true

            fixtures.reject(creativeId)
            refreshIndex.refresh()
            hasAd("i9-reject") shouldBe false
        }
    }

    given("지면 형식과 비율이 다른 소재") {
        then("승인돼 있어도 그 지면 후보가 되지 않는다") {
            fixtures.placement("i9-ratio", ratios = "1.91:1")
            val advertiserId = fixtures.memberAdvertiser(6004)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf("i9-ratio"))
            fixtures.paidCreative(campaignId, advertiserId, width = 600, height = 600)
            refreshIndex.refresh()
            hasAd("i9-ratio") shouldBe false
        }
    }

    given("형태 규격 사전 필터 — 두 형태를 받는 지면 (카드 0.10 · 띠배너 0.05)") {
        then("eCPM 0.07 띠배너는 남고 같은 eCPM 의 카드는 빠진다 — 띠배너 행은 (광고주 종류, 캠페인 형태)로 읽힌다") {
            fixtures.placement("i4-dual", formats = listOf(AdsFixtures.CARD, AdsFixtures.BANNER))
            // 카드를 먼저 넣어 캠페인 id 가 작다 — 인덱스에 남으면 동률 규칙으로 카드가 이긴다
            val cardAdvertiser = fixtures.memberAdvertiser(12_301)
            val cardCampaign = fixtures.paidCampaign(cardAdvertiser, listOf("i4-dual"), bidMicros = 70_000)
            fixtures.paidCreative(cardCampaign, cardAdvertiser)
            val stripAdvertiser = fixtures.memberAdvertiser(12_302)
            val stripCampaign = fixtures.paidCampaign(stripAdvertiser, listOf("i4-dual"), bidMicros = 70_000, format = "BANNER")
            val stripCreative = fixtures.paidCreative(stripCampaign, stripAdvertiser, width = 1280, height = 200, title = "띠배너 대체 텍스트", body = "")
            refreshIndex.refresh()

            val ad = client.decide(listOf("i4-dual"), visitorId = "vid-i4-1").placement("i4-dual")["ad"]
            ad["creativeId"].asLong() shouldBe stripCreative
            ad["format"].asString() shouldBe "BANNER"
            ad["title"].asString() shouldBe "띠배너 대체 텍스트"
            ad["body"].asString() shouldBe ""
        }
        then("캠페인 형태의 규격이 없는 지면에서는 후보가 되지 않는다") {
            fixtures.placement("i4-card-only")
            val advertiserId = fixtures.memberAdvertiser(12_303)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf("i4-card-only"), bidMicros = 500_000, format = "BANNER")
            fixtures.paidCreative(campaignId, advertiserId, width = 1280, height = 200, title = "대체", body = "")
            refreshIndex.refresh()
            hasAd("i4-card-only") shouldBe false
        }
        then("이미지가 캠페인 형태 규격의 비율과 다르면 — 지면의 다른 형태 규격에 맞아도 — 후보가 되지 않는다") {
            fixtures.placement("i4-misfit", formats = listOf(AdsFixtures.CARD, AdsFixtures.BANNER))
            val advertiserId = fixtures.memberAdvertiser(12_304)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf("i4-misfit"), bidMicros = 500_000, format = "BANNER")
            fixtures.paidCreative(campaignId, advertiserId, width = 1200, height = 628, title = "대체", body = "")
            refreshIndex.refresh()
            hasAd("i4-misfit") shouldBe false
        }
    }

    given("인덱스 갱신 시각 메트릭") {
        then("갱신을 부른 시각(epoch 초)을 가리킨다") {
            val at = NOON_HALF.plusMinutes(7)
            clock.set(at)
            try {
                refreshIndex.refresh()
                meterRegistry.get(DecisionMetrics.INDEX_REFRESHED_AT).gauge().value() shouldBe
                    at.atZone(KST).toEpochSecond().toDouble()
            } finally {
                clock.set(NOON_HALF)
            }
        }
    }
})
