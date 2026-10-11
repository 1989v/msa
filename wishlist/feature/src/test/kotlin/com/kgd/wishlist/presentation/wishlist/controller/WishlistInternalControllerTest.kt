package com.kgd.wishlist.presentation.wishlist.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.application.wishlist.service.WishlistService
import com.kgd.wishlist.domain.model.WishlistTargetCount
import com.kgd.wishlist.domain.model.WishlistTargetType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * 찜 집계 내부 경로 — 재색인(search-batch)이 하루 한 번 부른다. 실제 서비스 + 저장소 대역, 운영과 같은 Kotlin 모듈 매퍼.
 * 판정은 저장소에 넘어간 하한·상한과 응답 본문의 키 집합이다. HAVING 하한 자체는 [WishlistSchemaIntegrationSpec] 이
 * 실제 MySQL 질의로 본다(2·3 경계).
 */
class WishlistInternalControllerTest : BehaviorSpec({
    val port = mockk<WishlistRepositoryPort>()
    val mapper = jacksonMapperBuilder().build()
    val mvc = MockMvcBuilders.standaloneSetup(WishlistInternalController(WishlistService(port)))
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(mapper))
        .build()
    val path = "/internal/wishlist/target-counts"

    beforeEach {
        clearMocks(port)
        every { port.countGroupedByTarget(any(), any(), any()) } returns listOf(WishlistTargetCount("101", 7), WishlistTargetCount("102", 3))
    }

    Given("관광지 찜 집계를 부르면") {
        Then("대상 키와 수만 낸다 — 회원 id·시각은 응답에 없다") {
            val res = mvc.perform(get(path).param("type", "ATTRACTION").param("min", "3")).andReturn().response
            res.status shouldBe 200
            val data = mapper.readTree(res.contentAsString).get("data")
            data.size() shouldBe 2
            data.forEach { it.propertyNames().toSet() shouldBe setOf("targetKey", "count") }
            data[0].get("targetKey").asString() shouldBe "101"
            data[0].get("count").asLong() shouldBe 7L
            res.contentAsString.contains("memberId") shouldBe false
            res.contentAsString.contains("createdAt") shouldBe false
            verify(exactly = 1) { port.countGroupedByTarget(WishlistTargetType.ATTRACTION, 3, 10_000) }
        }
        Then("type 은 대소문자를 가리지 않는다") {
            mvc.perform(get(path).param("type", "attraction").param("min", "3")).andReturn().response.status shouldBe 200
            verify(exactly = 1) { port.countGroupedByTarget(WishlistTargetType.ATTRACTION, 3, 10_000) }
        }
    }

    Given("하한") {
        Then("min 을 안 주면 3 이다") {
            mvc.perform(get(path).param("type", "ATTRACTION")).andReturn().response.status shouldBe 200
            verify(exactly = 1) { port.countGroupedByTarget(WishlistTargetType.ATTRACTION, 3, 10_000) }
        }
        Then("0·음수는 1 로 막는다 — 찜이 없는 대상을 셀 일은 없다") {
            mvc.perform(get(path).param("type", "ATTRACTION").param("min", "0")).andReturn().response.status shouldBe 200
            mvc.perform(get(path).param("type", "ATTRACTION").param("min", "-5")).andReturn().response.status shouldBe 200
            verify(exactly = 2) { port.countGroupedByTarget(WishlistTargetType.ATTRACTION, 1, 10_000) }
        }
    }

    Given("잘못된 type") {
        Then("400 이고 저장소를 부르지 않는다") {
            mvc.perform(get(path).param("type", "HOTEL").param("min", "3")).andReturn().response.status shouldBe 400
            verify(exactly = 0) { port.countGroupedByTarget(any(), any(), any()) }
        }
    }
})
