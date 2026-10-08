package com.kgd.wishlist.presentation.share.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.wishlist.application.share.config.WishlistShareProperties
import com.kgd.wishlist.application.share.service.CollectionShareService
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType
import com.kgd.wishlist.support.FakeCollectionSharePort
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpHeaders
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.net.URI
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

/**
 * 공개 열람과 단축 주소 `/c`. 실제 서비스 + 저장소 대역, 운영과 같은 Kotlin 모듈 매퍼.
 * 판정은 응답 본문의 키 집합과 302 의 `Location` — 목적지 호스트는 운영값이 아닌 테스트 origin 이어야 한다.
 */
class SharedCollectionControllerTest : BehaviorSpec({

    val now = Instant.parse("2026-10-09T00:00:00Z")
    val clock = Clock.fixed(now, ZoneOffset.UTC)
    val mapper = jacksonMapperBuilder().build()
    val collectionId = 5L
    val base = LocalDateTime.of(2026, 10, 1, 0, 0)

    val port = FakeCollectionSharePort(
        mutableListOf(WishlistCollection.restore(collectionId, 1L, "제주 여행", LocalDateTime.now())),
    ).apply {
        // 관광지 101건(1분 간격) + 상품 1건 — 상품은 공개 응답에 나오지 않는다
        (1..101).forEach { i ->
            items += WishlistItem.restore(
                i.toLong(), 1L, collectionId, WishlistTargetType.ATTRACTION, "$i", base.plusMinutes(i.toLong()),
            )
        }
        items += WishlistItem.restore(500L, 1L, collectionId, WishlistTargetType.PRODUCT, "p1", base.plusDays(1))
    }
    val service = CollectionShareService(
        port, WishlistShareProperties(enabled = true), ShortLinkProperties(origin = "https://short.test"), clock,
    )
    val token = service.create(1L, collectionId, 30).token
    val mvc = MockMvcBuilders.standaloneSetup(SharedCollectionController(service, service))
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(mapper))
        .build()

    Given("GET /api/v1/wishlist/shared/{token}") {
        val res = mvc.perform(get("/api/v1/wishlist/shared/$token")).andReturn().response
        val data = mapper.readTree(res.contentAsString)["data"]

        Then("키 집합이 정확히 name·items·truncated — 소유자 id·시각이 없다") {
            res.status shouldBe 200
            data.propertyNames().toSet() shouldBe setOf("name", "items", "truncated")
            data["items"].forEach { it.propertyNames().toSet() shouldBe setOf("targetType", "targetKey") }
            data["name"].asString() shouldBe "제주 여행"
        }
        Then("101건이면 최신 100건 + truncated, 관광지만") {
            data["items"].size() shouldBe 100
            data["truncated"].asBoolean() shouldBe true
            data["items"][0]["targetKey"].asString() shouldBe "101"
            data["items"].all { it["targetType"].asString() == "ATTRACTION" } shouldBe true
        }
        Then("형식이 맞지만 없는 토큰은 404") {
            mvc.perform(get("/api/v1/wishlist/shared/Zzzzzzzzzz")).andReturn().response.status shouldBe 404
        }
    }

    Given("단축 주소 /c/{영숫자 10자}") {
        val res = mvc.perform(get("/c/$token")).andReturn().response

        Then("설정 호스트의 수신 화면으로 302 하고 캐시·색인을 막는다") {
            res.status shouldBe 302
            res.getHeader(HttpHeaders.LOCATION) shouldBe "https://short.test/shared/$token"
            res.getHeader(HttpHeaders.CACHE_CONTROL) shouldBe "no-store"
            res.getHeader("X-Robots-Tag") shouldBe "noindex, nofollow"
        }
    }

    Given("형식이 틀린 단축 주소") {
        Then("`/c`·`/c/`·`/c/a/b`·`/c/%2F%2Fevil.com`·9자·11자 모두 설정 호스트의 /shared/invalid 로") {
            val requests = mapOf(
                "/c" to get("/c"),
                "/c/" to get("/c/"),
                "/c/a/b" to get("/c/a/b"),
                // get(String) 은 % 를 %25 로 다시 인코딩한다 — 인코딩된 입력은 URI 로 보낸다
                "/c/%2F%2Fevil.com" to get(URI.create("/c/%2F%2Fevil.com")),
                "9자" to get("/c/abcdefghi"),
                "11자" to get("/c/abcdefghijk"),
            )
            requests.forEach { (name, req) ->
                val res = mvc.perform(req).andReturn().response
                withClue(name) {
                    res.status shouldBe 302
                    res.getHeader(HttpHeaders.LOCATION) shouldBe "https://short.test/shared/invalid"
                }
            }
        }
    }
})
