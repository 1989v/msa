package com.kgd.ads.application.decision

import com.kgd.ads.application.decision.usecase.RefreshCandidateIndexUseCase
import com.kgd.ads.support.AdsApiClient
import com.kgd.ads.support.AdsIntegrationSpec
import com.kgd.ads.support.DockerAvailable
import com.kgd.ads.support.items
import io.kotest.core.annotation.EnabledIf
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.env.Environment

/**
 * 전환 릴리스의 옛 지면 조회 — game 이 주던 모양(`placementKey`·`adType`·`provider`·`creatives[title, body, href, emoji]`)
 * 그대로 ads 의 HOUSE 소재를 준다. 기대값은 game 스키마에서 옮긴 `game-list-banner` 시드 3종이다.
 */
@EnabledIf(DockerAvailable::class)
class LegacyPlacementIntegrationSpec(
    @Autowired env: Environment,
    @Autowired refreshIndex: RefreshCandidateIndexUseCase,
) : AdsIntegrationSpec({

    val api = AdsApiClient(env.getRequiredProperty("local.server.port").toInt())

    given("옛 화면이 부르는 game-list-banner") {
        refreshIndex.refresh()
        val response = api.get("/api/v1/ads/placements/game-list-banner?subject=device-1", null)

        then("옛 응답 모양 그대로 옮겨 온 HOUSE 소재를 준다") {
            response.status shouldBe 200
            val data = response.data
            data.propertyNames().toSet() shouldBe setOf("placementKey", "adType", "provider", "creatives")
            data["placementKey"].asString() shouldBe "game-list-banner"
            data["adType"].asString() shouldBe "BANNER"
            data["provider"].asString() shouldBe "HOUSE"
            val creatives = data["creatives"].items()
            creatives.forEach { it.propertyNames().toSet() shouldBe setOf("title", "body", "href", "emoji") }
            creatives.map { listOf(it["title"].asString(), it["href"].asString(), it["emoji"].asString()) } shouldContainAll listOf(
                listOf("IT 개념 사전", "/", "📚"),
                listOf("커머스 쇼핑", "/shop", "🛒"),
                listOf("포트폴리오", "/portfolio", "🗂️"),
            )
        }
        then("subject 없이도 같은 답을 준다") {
            api.get("/api/v1/ads/placements/game-list-banner", null).status shouldBe 200
        }
        then("등록되지 않은 지면은 404") {
            api.get("/api/v1/ads/placements/not-registered-anywhere?subject=device-1", null).status shouldBe 404
        }
    }
})
