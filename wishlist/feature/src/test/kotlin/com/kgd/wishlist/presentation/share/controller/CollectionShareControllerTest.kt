package com.kgd.wishlist.presentation.share.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.wishlist.application.share.config.WishlistShareProperties
import com.kgd.wishlist.application.share.service.CollectionShareService
import com.kgd.wishlist.domain.model.CollectionShare
import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.support.FakeCollectionSharePort
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

/**
 * 소유자 공유 API — 컨트롤러부터 실제 서비스·도메인까지 태우고 저장소만 대역이다.
 * 메시지 변환기는 운영과 같은 Kotlin 모듈 매퍼다 — 본문 없음 · `{}` · 명시 null 의 갈림이
 * 이 매퍼의 기본값 처리에 달려 있어서 기본 변환기로 통과한 결과는 운영의 증거가 아니다.
 */
class CollectionShareControllerTest : BehaviorSpec({

    val now = Instant.parse("2026-10-09T00:00:00Z")
    val clock = Clock.fixed(now, ZoneOffset.UTC)
    val mapper = jacksonMapperBuilder().build()
    val owner = 1L
    val mine = 5L
    val others = 6L
    val base = "/api/v1/wishlist/collections"

    fun mvc(port: FakeCollectionSharePort): MockMvc {
        // 운영 기본값과 다른 호스트 — url 이 리터럴이 아니라 설정에서 오는지 가른다
        val service = CollectionShareService(
            port, WishlistShareProperties(enabled = true), ShortLinkProperties(origin = "https://short.test"), clock,
        )
        return MockMvcBuilders.standaloneSetup(CollectionShareController(service))
            .setControllerAdvice(GlobalExceptionHandler())
            .setMessageConverters(JacksonJsonHttpMessageConverter(mapper))
            .build()
    }

    fun newPort() = FakeCollectionSharePort(
        mutableListOf(
            WishlistCollection.restore(mine, owner, "제주 여행", LocalDateTime.now()),
            WishlistCollection.restore(others, 2L, "부산 여행", LocalDateTime.now()),
        ),
    )

    fun MockHttpServletResponse.json(): JsonNode = mapper.readTree(contentAsString)

    fun MockMvc.create(collectionId: Long = mine, body: String? = null): MockHttpServletResponse {
        val req = post("$base/$collectionId/share").header("X-User-Id", owner)
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body)
        return perform(req).andReturn().response
    }

    fun MockMvc.read(collectionId: Long = mine) =
        perform(get("$base/$collectionId/share").header("X-User-Id", owner)).andReturn().response

    fun MockMvc.revoke(collectionId: Long = mine) =
        perform(delete("$base/$collectionId/share").header("X-User-Id", owner)).andReturn().response

    Given("POST …/share 의 만료 일수") {
        val in30Days = "2026-11-08T00:00:00Z"

        Then("본문이 없으면 Clock + 30일, url 은 설정 호스트 + /c/ + 토큰") {
            val res = mvc(newPort()).create()
            res.status shouldBe 200
            val data = res.json()["data"]
            data["expiresAt"].asString() shouldBe in30Days
            val token = data["token"].asString()
            CollectionShare.TOKEN_PATTERN.matches(token).shouldBeTrue()
            data["url"].asString() shouldBe "https://short.test/c/$token"
        }
        Then("`{}` 도 30일이다") {
            mvc(newPort()).create(body = "{}").json()["data"]["expiresAt"].asString() shouldBe in30Days
        }
        Then("명시 null 은 만료 없음이다 — 키는 남고 값이 null") {
            val data = mvc(newPort()).create(body = """{"expiresInDays":null}""").json()["data"]
            data.has("expiresAt").shouldBeTrue()
            data["expiresAt"].isNull.shouldBeTrue()
        }
        Then("1·365 는 200, 0·366 은 400") {
            mapOf(1 to 200, 365 to 200, 0 to 400, 366 to 400).forEach { (days, status) ->
                withClue("expiresInDays=$days") {
                    mvc(newPort()).create(body = """{"expiresInDays":$days}""").status shouldBe status
                }
            }
        }
    }

    Given("GET …/share") {
        Then("링크가 없으면 404 가 아니라 200 link:null") {
            val res = mvc(newPort()).read()
            res.status shouldBe 200
            val data = res.json()["data"]
            data.has("link").shouldBeTrue()
            data["link"].isNull.shouldBeTrue()
        }
        Then("만든 뒤에는 같은 토큰·url 을 돌려준다") {
            val mvc = mvc(newPort())
            val created = mvc.create().json()["data"]
            val link = mvc.read().json()["data"]["link"]
            link["token"].asString() shouldBe created["token"].asString()
            link["url"].asString() shouldBe "https://short.test/c/${created["token"].asString()}"
        }
    }

    Given("DELETE …/share") {
        Then("두 번 불러도 둘 다 200 이고 그 뒤 링크는 없다") {
            val mvc = mvc(newPort())
            mvc.create()
            mvc.revoke().status shouldBe 200
            mvc.revoke().status shouldBe 200
            mvc.read().json()["data"]["link"].isNull.shouldBeTrue()
        }
    }

    Given("없는 묶음과 남의 묶음") {
        Then("세 메서드 모두 같은 404 본문이다") {
            val calls = listOf<Pair<String, MockMvc.(Long) -> MockHttpServletResponse>>(
                "POST" to { id -> create(id) },
                "GET" to { id -> read(id) },
                "DELETE" to { id -> revoke(id) },
            )
            calls.forEach { (name, call) ->
                val missing = mvc(newPort()).call(999L)
                val foreign = mvc(newPort()).call(others)
                withClue(name) {
                    missing.status shouldBe 404
                    foreign.status shouldBe 404
                    foreign.contentAsString shouldBe missing.contentAsString
                }
            }
        }
    }
})
