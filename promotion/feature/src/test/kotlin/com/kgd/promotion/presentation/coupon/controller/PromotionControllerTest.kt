package com.kgd.promotion.presentation.coupon.controller

import com.kgd.promotion.application.PromotionHarness
import com.kgd.promotion.application.coupon.service.CouponDefinitionService
import com.kgd.promotion.presentation.point.controller.PointController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * 혜택 API 의 신원·권한 판정 — 컨트롤러부터 실제 서비스·도메인까지 태우고 저장소만 메모리.
 * 판정 근거는 응답 코드와 저장된 행이다.
 */
class PromotionControllerTest : BehaviorSpec({

    fun mvc(h: PromotionHarness) = MockMvcBuilders
        .standaloneSetup(
            CouponController(h.claims, h.claims),
            CouponAdminController(CouponDefinitionService(h.definitions, h.events, h.clock)),
            PointController(h.pointService, h.pointService),
        )
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    fun MockHttpServletRequestBuilder.identity(userId: String?, roles: String?) = apply {
        userId?.let { header("X-User-Id", it) }
        roles?.let { header("X-User-Roles", it) }
    }

    val createBody = """
        {"name":"가을 쿠폰","type":"RATE","rateBp":1000,"maxDiscount":3000,"minOrderAmount":10000,
         "validFrom":"2026-10-01T00:00:00Z","validUntil":"2026-10-31T00:00:00Z","issueLimit":5}
    """.trimIndent()

    fun create(h: PromotionHarness, userId: String?, roles: String?, body: String = createBody) = mvc(h).perform(
        MockMvcRequestBuilders.post("/api/v1/admin/promotions/coupons").contentType(MediaType.APPLICATION_JSON)
            .content(body).identity(userId, roles),
    ).andReturn().response

    given("내 쿠폰·포인트") {
        then("X-User-Id 가 없으면 401 — 남의 것으로 떨어지지 않는다") {
            val h = PromotionHarness()
            mvc(h).perform(MockMvcRequestBuilders.get("/api/v1/coupons/me")).andReturn().response.status shouldBe 401
            mvc(h).perform(MockMvcRequestBuilders.get("/api/v1/points/me")).andReturn().response.status shouldBe 401
            mvc(h).perform(MockMvcRequestBuilders.post("/api/v1/coupons/1/claim")).andReturn().response.status shouldBe 401
        }
        then("받은 쿠폰은 본인 목록에만 나온다") {
            val h = PromotionHarness()
            val id = requireNotNull(h.fixedCoupon().id)
            mvc(h).perform(MockMvcRequestBuilders.post("/api/v1/coupons/$id/claim").identity("7", "ROLE_USER"))
                .andReturn().response.status shouldBe 201
            mvc(h).perform(MockMvcRequestBuilders.post("/api/v1/coupons/$id/claim").identity("7", "ROLE_USER"))
                .andReturn().response.status shouldBe 409

            mvc(h).perform(MockMvcRequestBuilders.get("/api/v1/coupons/me").identity("7", "ROLE_USER"))
                .andReturn().response.contentAsString shouldContain "\"userCouponId\":1"
            mvc(h).perform(MockMvcRequestBuilders.get("/api/v1/coupons/me").identity("8", "ROLE_USER"))
                .andReturn().response.contentAsString shouldContain "\"data\":[]"
        }
    }

    given("어드민 쿠폰 정의") {
        then("ROLE_ADMIN 이 아니면 403, 헤더가 없으면 401 — 정의가 생기지 않는다") {
            val h = PromotionHarness()
            create(h, "7", "ROLE_USER,ROLE_SELLER").status shouldBe 403
            create(h, null, "ROLE_ADMIN").status shouldBe 401
            h.definitions.rows.size shouldBe 0
        }
        then("어드민은 만들고 만든 사람이 남는다, promotion.coupon.defined 한 건") {
            val h = PromotionHarness()
            create(h, "1", "ROLE_ADMIN").status shouldBe 201
            h.definitions.rows.values.single().createdBy shouldBe "1"
            h.events.defined.size shouldBe 1
        }
        then("정률인데 최대 할인이 없으면 400") {
            val h = PromotionHarness()
            create(h, "1", "ROLE_ADMIN", createBody.replace("\"maxDiscount\":3000,", "")).status shouldBe 400
        }
    }

    given("어드민 포인트 지급") {
        then("ROLE_ADMIN 만 — 지급자·사유가 원장에 남는다") {
            val h = PromotionHarness()
            fun grant(roles: String) = mvc(h).perform(
                MockMvcRequestBuilders.post("/api/v1/admin/promotions/points/grants").contentType(MediaType.APPLICATION_JSON)
                    .content("""{"memberId":"7","amount":3000,"reason":"데모"}""").identity("1", roles),
            ).andReturn().response.status
            grant("ROLE_USER") shouldBe 403
            grant("ROLE_ADMIN") shouldBe 201
            h.balanceOf("7") shouldBe 3_000L
            h.ledger.rows.single().let {
                it.actorId shouldBe "1"
                it.reason shouldBe "데모"
            }
        }
    }
})
