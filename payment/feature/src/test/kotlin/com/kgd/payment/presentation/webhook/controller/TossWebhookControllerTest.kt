package com.kgd.payment.presentation.webhook.controller

import com.kgd.payment.application.payment.port.PaymentEventType
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgResult
import com.kgd.payment.application.payment.service.PaymentHarness
import com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase
import com.kgd.payment.domain.payment.model.PaymentStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.verify
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * 토스 웹훅 — 컨트롤러부터 실제 결론 서비스까지 태우고 PG 만 목으로 둔다.
 * 판정 근거: 응답 코드 · PG 재조회 호출 수 · 결제 행 상태(본문이 아니라 재조회가 정했는가). 헤더는 아무것이나 붙여도 판정에 안 쓰인다.
 */
class TossWebhookControllerTest : BehaviorSpec({

    fun setup(): Pair<PaymentHarness, org.springframework.test.web.servlet.MockMvc> {
        val h = PaymentHarness()
        every { h.pg.authorize(any(), any()) } returns PgResult.Unknown("TIMEOUT")
        h.commands.authorize(ProcessPaymentCommandUseCase.Authorize(100L, "ORD-100-1", 10_000L))
        val mvc = MockMvcBuilders.standaloneSetup(TossWebhookController(h.resolution))
            .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
            .build()
        return h to mvc
    }

    fun org.springframework.test.web.servlet.MockMvc.post(body: String = BODY): Int = perform(
        MockMvcRequestBuilders.post("/api/v1/payments/webhooks/toss")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Toss-Webhook-Secret", "anything")
            .content(body),
    ).andReturn().response.status

    given("웹훅은 재조회 신호일 뿐 — 서명·비밀 헤더가 없다") {
        then("본문이 DONE · 1원이라고 해도 상태는 주문번호로 PG 를 재조회한 결과(거절)로 정한다") {
            val (h, mvc) = setup()
            every { h.pg.inquire("ORD-100-1") } returns PgInquiry.Declined("REJECT_CARD_PAYMENT")

            mvc.post() shouldBe 200

            verify(exactly = 1) { h.pg.inquire("ORD-100-1") }
            h.payments.rows.values.single().status shouldBe PaymentStatus.FAILED
            verify(exactly = 0) { h.events.publish(PaymentEventType.AUTHORIZED, any(), any(), any()) }
        }

        then("주문번호가 없으면 400, 모르는 주문번호면 200 — 둘 다 PG 를 부르지 않는다") {
            val (h, mvc) = setup()

            mvc.post("""{"eventType":"PAYMENT_STATUS_CHANGED","data":{"status":"DONE"}}""") shouldBe 400
            mvc.post(BODY.replace("ORD-100-1", "ORD-999-1")) shouldBe 200

            verify(exactly = 0) { h.pg.inquire(any()) }
            h.payments.rows.values.single().status shouldBe PaymentStatus.UNKNOWN
        }
    }

    given("같은 웹훅이 두 번 온다") {
        then("두 번째는 이미 결론 난 결제라 PG 를 부르지 않고 그대로 둔다 (200)") {
            val (h, mvc) = setup()
            every { h.pg.inquire("ORD-100-1") } returns PgInquiry.Approved("tpk_1", 10_000L, captured = true)

            mvc.post() shouldBe 200
            mvc.post() shouldBe 200

            verify(exactly = 1) { h.pg.inquire(any()) }
            h.payments.rows.values.single().status shouldBe PaymentStatus.CAPTURED
            verify(exactly = 1) { h.events.publish(PaymentEventType.CAPTURED, any(), any(), any()) }
        }
    }
}) {
    companion object {
        val BODY = """
            {"eventType":"PAYMENT_STATUS_CHANGED","createdAt":"2026-09-24T10:00:00.000000",
             "data":{"paymentKey":"tpk_1","orderId":"ORD-100-1","status":"DONE","totalAmount":1}}
        """.trimIndent()
    }
}
