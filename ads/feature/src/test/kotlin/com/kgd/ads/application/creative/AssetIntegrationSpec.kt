package com.kgd.ads.application.creative

import com.kgd.ads.support.AdsFixtures
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.EventClient
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import javax.sql.DataSource

/** 소재 이미지 응답 — 저장된 형식 그대로의 Content-Type · nosniff · 1년 불변 캐시. */
@EnabledIf(DockerAvailable::class)
class AssetIntegrationSpec(
    @Autowired env: Environment,
    @Autowired @Qualifier("adsDataSource") adsDataSource: DataSource,
) : AdsIntegrationSpec({

    val jdbc = JdbcTemplate(adsDataSource)
    val fixtures = AdsFixtures(jdbc)
    val client = EventClient(env.getRequiredProperty("local.server.port").toInt())

    given("저장된 소재 이미지") {
        then("저장한 바이트와 형식을 불변 캐시·nosniff 헤더와 함께 준다") {
            fixtures.placement("a-asset")
            val advertiserId = fixtures.memberAdvertiser(8001)
            val campaignId = fixtures.paidCampaign(advertiserId, listOf("a-asset"))
            val creativeId = fixtures.paidCreative(campaignId, advertiserId)
            val hash = jdbc.queryForObject("SELECT image_hash FROM ad_creative WHERE id = ?", String::class.java, creativeId)!!

            val response = client.asset(hash)
            response.statusCode() shouldBe 200
            response.body().toList() shouldBe listOf<Byte>(1, 2, 3, 4)
            response.headers().firstValue("Content-Type").orElse(null) shouldBe "image/png"
            response.headers().firstValue("X-Content-Type-Options").orElse(null) shouldBe "nosniff"
            response.headers().firstValue("Cache-Control").orElse(null) shouldBe "max-age=31536000, public, immutable"
        }
    }

    given("없는 해시·형식이 틀린 해시") {
        then("404") {
            client.asset("0".repeat(64)).statusCode() shouldBe 404
            client.asset("not-a-hash").statusCode() shouldBe 404
        }
    }
})
