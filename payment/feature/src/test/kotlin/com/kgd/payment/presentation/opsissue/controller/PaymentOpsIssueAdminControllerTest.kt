package com.kgd.payment.presentation.opsissue.controller

import com.kgd.payment.application.opsissue.service.OpsIssueService
import com.kgd.payment.application.opsissue.service.OpsIssueTransactionalService
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.service.InMemoryReconciliations
import com.kgd.payment.application.payment.service.PaymentHarness
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

/** 결제 운영 이슈 어드민 API — 권한 판정과 재시도·종결이 실제로 행을 바꾸는지. */
class PaymentOpsIssueAdminControllerTest : BehaviorSpec({

    /** 재조회 5회 소진 → PAYMENT_UNKNOWN 이슈 1건이 있는 상태 */
    fun setup(): Pair<PaymentHarness, org.springframework.test.web.servlet.MockMvc> {
        val h = PaymentHarness()
        every { h.pg.authorize(any(), any()) } returns PgResult.Unknown("TIMEOUT")
        every { h.pg.inquire(any()) } returns PgInquiry.Unavailable("PENDING")
        h.commands.authorize(ProcessPaymentCommandUseCase.Authorize(100L, "ORD-100-1", 10_000L))
        listOf(30L, 60L, 120L, 240L, 150L).forEach { h.clock.now = h.clock.now.plusSeconds(it); h.resolution.resolveDue() }
        val tx = OpsIssueTransactionalService(h.opsIssues, h.payments, InMemoryReconciliations(), h.clock)
        val service = OpsIssueService(h.opsIssues, tx, mockk<ReconcilePaymentsUseCase>())
        val mvc = MockMvcBuilders.standaloneSetup(PaymentOpsIssueAdminController(service, service))
            .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
            .build()
        return h to mvc
    }

    fun MockHttpServletRequestBuilder.as_(userId: String?, roles: String?) = apply {
        userId?.let { header("X-User-Id", it) }
        roles?.let { header("X-User-Roles", it) }
    }

    fun org.springframework.test.web.servlet.MockMvc.status(req: MockHttpServletRequestBuilder) =
        perform(req).andReturn().response.status

    given("권한") {
        then("헤더 없음 401 · ROLE_USER 403 · 어드민 200") {
            val (_, mvc) = setup()
            val path = "/api/v1/admin/payments/ops-issues"
            mvc.status(MockMvcRequestBuilders.get(path)) shouldBe 401
            mvc.status(MockMvcRequestBuilders.get(path).as_("7", "ROLE_USER")) shouldBe 403
            mvc.status(MockMvcRequestBuilders.get(path).as_("1", "ROLE_ADMIN")) shouldBe 200
        }
    }

    given("재시도 · 종결") {
        then("재시도는 결제 재조회를 처음부터 다시 잡고, 종결은 사유와 처리자를 남긴다 — 종결 뒤 재시도는 409") {
            val (h, mvc) = setup()
            val id = h.opsIssues.rows.keys.single()
            h.payments.rows.values.single().nextInquiryAt shouldBe null

            mvc.status(MockMvcRequestBuilders.post("/api/v1/admin/payments/ops-issues/$id/retry").as_("1", "ROLE_ADMIN")) shouldBe 200
            h.opsIssues.rows[id]!!.status shouldBe OpsIssueStatus.RETRIED
            h.payments.rows.values.single().let {
                it.inquiryAttempts shouldBe 0
                it.nextInquiryAt shouldBe h.clock.now
            }

            mvc.status(
                MockMvcRequestBuilders.post("/api/v1/admin/payments/ops-issues/$id/close").as_("1", "ROLE_ADMIN")
                    .contentType(MediaType.APPLICATION_JSON).content("""{"reason":"PG 콘솔에서 승인 없음 확인"}"""),
            ) shouldBe 200
            h.opsIssues.rows[id]!!.let {
                it.status shouldBe OpsIssueStatus.CLOSED
                it.actorId shouldBe "1"
                it.reason shouldBe "PG 콘솔에서 승인 없음 확인"
            }

            mvc.status(MockMvcRequestBuilders.post("/api/v1/admin/payments/ops-issues/$id/retry").as_("1", "ROLE_ADMIN")) shouldBe 409
        }
    }
})
