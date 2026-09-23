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
