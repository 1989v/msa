package com.kgd.order.presentation.order.controller

import com.kgd.order.application.order.usecase.GetOrderStatsUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

/** 매출 통계는 어드민 전용 — 게이트웨이(ROLE_ADMIN)와 별개로 서비스도 역할을 본다. */
class OrderStatsControllerTest : BehaviorSpec({
    val stats = mockk<GetOrderStatsUseCase>()
    every { stats.todayOrderCount() } returns 3L
    val mockMvc = MockMvcBuilders.standaloneSetup(OrderStatsController(stats))
        .setControllerAdvice(OrderExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    fun status(userId: String?, roles: String?, path: String = "/api/v1/admin/orders/stats/today"): Int =
        mockMvc.perform(
            get(path).apply {
                userId?.let { header("X-User-Id", it) }
                roles?.let { header("X-User-Roles", it) }
            },
        ).andReturn().response.status

    given("매출 통계") {
        then("ROLE_USER 는 403") { status("7", "ROLE_USER") shouldBe 403 }
        then("신원 헤더가 없으면 401") { status(null, null) shouldBe 401 }
        then("ROLE_ADMIN 은 200") { status("1", "ROLE_USER,ROLE_ADMIN") shouldBe 200 }
        then("옛 경로 /api/orders/stats 는 없다") { status("1", "ROLE_ADMIN", "/api/orders/stats/today") shouldBe 404 }
    }
})
