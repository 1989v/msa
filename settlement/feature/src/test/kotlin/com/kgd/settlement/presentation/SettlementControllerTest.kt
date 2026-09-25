package com.kgd.settlement.presentation

import com.kgd.settlement.application.SettlementHarness
import com.kgd.settlement.application.ledger.usecase.RecordLedgerUseCase
import com.kgd.settlement.application.statement.usecase.RegisterSettlementItemUseCase
import com.kgd.settlement.domain.ledger.model.LineAmounts
import com.kgd.settlement.domain.seller.model.SettlementSeller
import com.kgd.settlement.domain.statement.model.SettlementCycle
import com.kgd.settlement.presentation.ledger.controller.LedgerAdminController
import com.kgd.settlement.presentation.statement.controller.SellerSettlementController
import com.kgd.settlement.presentation.statement.controller.SettlementAdminController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import tools.jackson.module.kotlin.readValue
import java.time.Instant

/** 정산 API — 신원 헤더 판정(401·403·404)과, 응답 값이 원장·정산서에서 온 값인지 */
class SettlementControllerTest : BehaviorSpec({

    val thursday = Instant.parse("2026-09-24T03:00:00Z")
    val mapper = jacksonMapperBuilder().build()

    /** 판매자 7(m7) 주간 정산서 PAID 1건 · 판매자 9(m9) 정지 */
    fun setup(): Pair<SettlementHarness, MockMvc> {
        val h = SettlementHarness(Instant.parse("2026-09-27T20:30:00Z"))
        h.sellerSync.sync(SettlementSeller(7L, "m7", "ACTIVE", SettlementCycle.WEEKLY, thursday))
        h.sellerSync.sync(SettlementSeller(9L, "m9", "SUSPENDED", SettlementCycle.WEEKLY, thursday))
        val line = LineAmounts(11L, 7L, 20_000L, 2_000L, 0L, 0L)
        h.ledger.recordCapture(RecordLedgerUseCase.Capture(501L, 20_000L, listOf(line), emptyList(), thursday, "e1"))
        h.register.register(RegisterSettlementItemUseCase.PurchaseConfirmed(501L, line, null, thursday))
        h.batch.run()
        val mvc = MockMvcBuilders.standaloneSetup(
            SellerSettlementController(h.queries),
            SettlementAdminController(h.queries, h.batch, h.batch),
            LedgerAdminController(h.ledger, h.ledger),
        ).setMessageConverters(JacksonJsonHttpMessageConverter(mapper)).build()
        return h to mvc
    }

    fun MockHttpServletRequestBuilder.as_(userId: String?, roles: String? = null) = apply {
        userId?.let { header("X-User-Id", it) }
        roles?.let { header("X-User-Roles", it) }
    }

    fun MockMvc.call(req: MockHttpServletRequestBuilder) = perform(req).andReturn().response

    Given("판매자 포털 /api/v1/seller/settlements") {
        Then("헤더 없음 401 · 판매자 아님 403 · 정지 판매자 403 · 본인 200 (지급액은 정산서 값)") {
            val (h, mvc) = setup()
            mvc.call(get("/api/v1/seller/settlements")).status shouldBe 401
            mvc.call(get("/api/v1/seller/settlements").as_("stranger")).status shouldBe 403
            mvc.call(get("/api/v1/seller/settlements").as_("m9")).status shouldBe 403

            val res = mvc.call(get("/api/v1/seller/settlements").as_("m7"))
            res.status shouldBe 200
            val body = mapper.readValue<Map<String, Any?>>(res.contentAsString)
            @Suppress("UNCHECKED_CAST")
            val rows = body["data"] as List<Map<String, Any?>>
            rows.size shouldBe 1
            (rows.single()["payout"] as Number).toLong() shouldBe h.statements.rows.values.single().payout
            rows.single()["status"] shouldBe "PAID"
        }
        Then("상세: 본인 것은 줄까지 200, 남의 것은 404") {
            val (h, mvc) = setup()
            val id = h.statements.rows.keys.single()
            h.sellerSync.sync(SettlementSeller(8L, "m8", "ACTIVE", SettlementCycle.WEEKLY, thursday))
            val mine = mvc.call(get("/api/v1/seller/settlements/$id").as_("m7"))
            mine.status shouldBe 200
            mine.contentAsString.contains("\"orderItemId\":11") shouldBe true
            mvc.call(get("/api/v1/seller/settlements/$id").as_("m8")).status shouldBe 404
        }
    }

    Given("어드민 /api/v1/admin/settlements/**") {
        Then("ROLE_USER 403 · 어드민 목록 200 · PAID 지급 재시도 409 · 시산표 합 0") {
            val (h, mvc) = setup()
            mvc.call(get("/api/v1/admin/settlements/statements").as_("u1", "ROLE_USER")).status shouldBe 403
            mvc.call(get("/api/v1/admin/settlements/ledger/trial-balance").as_("u1", "ROLE_USER,ROLE_SELLER")).status shouldBe 403
            mvc.call(get("/api/v1/admin/settlements/statements").as_("a1", "ROLE_USER,ROLE_ADMIN")).status shouldBe 200

            val id = h.statements.rows.keys.single()
            mvc.call(post("/api/v1/admin/settlements/statements/$id/retry-payout").as_("a1", "ROLE_ADMIN")).status shouldBe 409

            val tb = mvc.call(get("/api/v1/admin/settlements/ledger/trial-balance").as_("a1", "ROLE_ADMIN"))
            tb.status shouldBe 200
            @Suppress("UNCHECKED_CAST")
            val data = mapper.readValue<Map<String, Any?>>(tb.contentAsString)["data"] as Map<String, Any?>
            (data["net"] as Number).toLong() shouldBe 0L
            (data["totalDebit"] as Number).toLong() shouldBe h.ledger.trialBalance().totalDebit
            tb.contentAsString.contains("\"name\":\"판매자 미지급금\"") shouldBe true
        }
        Then("정산서 응답은 명목 기간과 함께 실제 포함 범위(최소~최대 확정 시각)를 싣는다") {
            val (_, mvc) = setup()
            val res = mvc.call(get("/api/v1/admin/settlements/statements").as_("a1", "ROLE_ADMIN"))
            @Suppress("UNCHECKED_CAST")
            val row = (mapper.readValue<Map<String, Any?>>(res.contentAsString)["data"] as List<Map<String, Any?>>).single()
            row["includedFrom"] shouldBe "2026-09-24T03:00:00Z"
            row["includedTo"] shouldBe "2026-09-24T03:00:00Z"
        }
    }

    Given("어드민 역분개 POST /api/v1/admin/settlements/ledger/journals/{id}/reverse") {
        fun reverse(id: Long, reason: String?) = post("/api/v1/admin/settlements/ledger/journals/$id/reverse")
            .contentType("application/json").content(mapper.writeValueAsString(mapOf("reason" to reason)))

        Then("ROLE_USER 403 · 사유 없음 400 · 없는 거래 404 · 역분개 거래는 다시 역분개 400") {
            val (h, mvc) = setup()
            val capture = requireNotNull(h.journals.journals.first().id)
            mvc.call(reverse(capture, "x").as_("u1", "ROLE_USER")).status shouldBe 403
            mvc.call(reverse(capture, " ").as_("a1", "ROLE_ADMIN")).status shouldBe 400
            mvc.call(reverse(9_999L, "x").as_("a1", "ROLE_ADMIN")).status shouldBe 404
            mvc.call(reverse(capture, "x").as_("a1", "ROLE_ADMIN")).status shouldBe 200
            val reversalId = requireNotNull(h.journals.journals.last().id)
            mvc.call(reverse(reversalId, "x").as_("a1", "ROLE_ADMIN")).status shouldBe 400
        }
        Then("행위자·사유를 남긴 역분개 거래 하나 — 같은 거래를 다시 요청하면 같은 역분개를 돌려주고, 원장 합은 0") {
            val (h, mvc) = setup()
            val capture = h.journals.journals.first()
            val before = h.journals.journals.size

            val first = mvc.call(reverse(requireNotNull(capture.id), "금액 오기입").as_("a1", "ROLE_ADMIN"))
            val again = mvc.call(reverse(requireNotNull(capture.id), "다시 누름").as_("a2", "ROLE_ADMIN"))

            first.status shouldBe 200
            again.status shouldBe 200
            h.journals.journals.size shouldBe before + 1
            val reversal = h.journals.journals.last()
            reversal.reversalOf shouldBe capture.id
            reversal.actorId shouldBe "a1"
            reversal.reason shouldBe "금액 오기입"
            @Suppress("UNCHECKED_CAST")
            val data = mapper.readValue<Map<String, Any?>>(again.contentAsString)["data"] as Map<String, Any?>
            (data["id"] as Number).toLong() shouldBe reversal.id
            data["actorId"] shouldBe "a1"
            h.ledger.trialBalance().net shouldBe 0L
        }
    }
})
