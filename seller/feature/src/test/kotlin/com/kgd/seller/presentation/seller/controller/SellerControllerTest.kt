package com.kgd.seller.presentation.seller.controller

import com.kgd.seller.application.seller.port.AccountCipherPort
import com.kgd.seller.application.seller.port.SellerAdminActionRepositoryPort
import com.kgd.seller.application.seller.port.SellerEventPort
import com.kgd.seller.application.seller.port.SellerRepositoryPort
import com.kgd.seller.application.seller.service.SellerAdminService
import com.kgd.seller.application.seller.service.SellerApplicationQueryService
import com.kgd.seller.application.seller.service.SellerService
import com.kgd.seller.domain.seller.model.EncryptedAccount
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerAdminAction
import com.kgd.seller.domain.seller.model.SellerAdminActionType
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.domain.seller.model.SettlementCycle
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Clock
import java.time.Instant

/**
 * 판매자 API 의 권한 판정 — 컨트롤러부터 실제 서비스·도메인까지 태우고 저장소만 목으로 둔다.
 * 판정 근거는 응답 코드와 저장·발행 호출 여부다.
 */
class SellerControllerTest : BehaviorSpec({
    val sellers = mockk<SellerRepositoryPort>()
    val actions = mockk<SellerAdminActionRepositoryPort>(relaxed = true)
    val events = mockk<SellerEventPort>(relaxed = true)
    val cipher = mockk<AccountCipherPort>()
    val clock = Clock.systemUTC()
    val service = SellerService(sellers, events, cipher, clock)
    val admin = SellerAdminService(sellers, actions, events, clock)
    val applications = SellerApplicationQueryService(sellers, actions)
    val mockMvc = MockMvcBuilders
        .standaloneSetup(SellerController(service, service, applications), SellerAdminController(service, admin))
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    fun row(status: SellerStatus, id: Long = 10L, rejectReason: String? = null) = Seller.restore(
        id, "7", "상호", "1234567890", "대표", "은행", EncryptedAccount("c", 1), "********6789", 3000L,
        SettlementCycle.WEEKLY, 1000, status, rejectReason, null, null, Instant.EPOCH, Instant.EPOCH,
    )

    beforeEach {
        clearMocks(sellers, actions, events, cipher)
        every { sellers.save(any()) } answers { firstArg() }
        every { cipher.encrypt(any()) } returns EncryptedAccount("c", 1)
    }

    fun action(type: SellerAdminActionType, reason: String?, at: Instant) = SellerAdminAction(
        sellerId = 10L, action = type, actorId = "1", reason = reason,
        fromStatus = SellerStatus.ACTIVE, toStatus = SellerStatus.SUSPENDED, commissionRateBp = null, createdAt = at,
    )

    fun MockHttpServletRequestBuilder.identity(userId: String?, roles: String?) = apply {
        userId?.let { header("X-User-Id", it) }
        roles?.let { header("X-User-Roles", it) }
    }

    fun me(userId: String?): Int = mockMvc.perform(
        MockMvcRequestBuilders.get("/api/v1/seller/me").identity(userId, "ROLE_SELLER"),
    ).andReturn().response.status

    val applyBody = """
        {"businessName":"상호","businessRegistrationNo":"123-45-67890","representativeName":"대표",
         "bankName":"은행","accountNumber":"110-123-456789","shippingFee":3000,"settlementCycle":"WEEKLY"}
    """.trimIndent()

    fun apply(userId: String?): Int = mockMvc.perform(
        MockMvcRequestBuilders.post("/api/v1/sellers/apply")
            .contentType(MediaType.APPLICATION_JSON).content(applyBody).identity(userId, "ROLE_USER"),
    ).andReturn().response.status

    given("판매자 포털 /api/v1/seller/me") {
        then("ACTIVE 판매자는 200") {
            every { sellers.findAllByMemberId("7") } returns listOf(row(SellerStatus.ACTIVE))
            me("7") shouldBe 200
        }
        then("정지된 판매자는 ROLE_SELLER 토큰이 유효해도 403") {
            every { sellers.findAllByMemberId("7") } returns listOf(row(SellerStatus.SUSPENDED))
            me("7") shouldBe 403
        }
        then("판매자 행이 없으면 403") {
            every { sellers.findAllByMemberId("8") } returns emptyList()
            me("8") shouldBe 403
        }
        then("X-User-Id 가 없으면 401") {
            me(null) shouldBe 401
        }
    }

    given("내 입점 신청 /api/v1/sellers/me — 상태 무관, 가장 최근 신청") {
        fun myApplication(userId: String?) = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/v1/sellers/me").identity(userId, "ROLE_USER"),
        ).andReturn().response

        then("PENDING 은 200 과 그 상태") {
            every { sellers.findAllByMemberId("7") } returns listOf(row(SellerStatus.PENDING))
            val res = myApplication("7")
            res.status shouldBe 200
            res.contentAsString shouldContain "\"status\":\"PENDING\""
        }
        then("반려 이력 뒤 재신청이 반려되면 가장 최근 행과 그 반려 사유") {
            every { sellers.findAllByMemberId("7") } returns listOf(
                row(SellerStatus.REJECTED, id = 3L, rejectReason = "예전 사유"),
                row(SellerStatus.REJECTED, id = 10L, rejectReason = "사업자번호 불일치"),
            )
            val res = myApplication("7")
            res.status shouldBe 200
            res.contentAsString shouldContain "사업자번호 불일치"
            res.contentAsString shouldNotContain "예전 사유"
        }
        then("SUSPENDED 는 200 과 가장 최근 정지 사유") {
            every { sellers.findAllByMemberId("7") } returns listOf(row(SellerStatus.SUSPENDED))
            every { actions.findAllBySellerId(10L) } returns listOf(
                action(SellerAdminActionType.SUSPEND, "첫 정지", Instant.parse("2026-09-01T00:00:00Z")),
                action(SellerAdminActionType.REACTIVATE, null, Instant.parse("2026-09-02T00:00:00Z")),
                action(SellerAdminActionType.SUSPEND, "허위 표시", Instant.parse("2026-09-03T00:00:00Z")),
            )
            val res = myApplication("7")
            res.status shouldBe 200
            res.contentAsString shouldContain "\"status\":\"SUSPENDED\""
            res.contentAsString shouldContain "\"suspendReason\":\"허위 표시\""
        }
        then("신청 행이 없으면 404") {
            every { sellers.findAllByMemberId("8") } returns emptyList()
            myApplication("8").status shouldBe 404
        }
        then("X-User-Id 가 없으면 401") {
            myApplication(null).status shouldBe 401
        }
    }

    given("입점 신청 /api/v1/sellers/apply") {
        then("정지된 판매자 행이 있는 회원은 409, 저장하지 않는다") {
            every { sellers.findAllByMemberId("7") } returns listOf(row(SellerStatus.SUSPENDED))
            apply("7") shouldBe 409
            verify(exactly = 0) { sellers.create(any()) }
        }
        then("처음 신청하는 회원은 201") {
            every { sellers.findAllByMemberId("9") } returns emptyList()
            every { sellers.create(any()) } answers { row(SellerStatus.PENDING) }
            apply("9") shouldBe 201
        }
        then("X-User-Id 가 없으면 401") {
            apply(null) shouldBe 401
        }
    }

    given("어드민 승인 /api/v1/admin/sellers/{id}/approve") {
        fun approve(userId: String?, roles: String?) = mockMvc.perform(
            MockMvcRequestBuilders.post("/api/v1/admin/sellers/10/approve")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"commissionRateBp":1200,"reason":"서류 확인"}""")
                .identity(userId, roles),
        ).andReturn().response.status

        then("ROLE_ADMIN 이 아니면 403, 상태를 바꾸지 않는다") {
            every { sellers.findById(10L) } returns row(SellerStatus.PENDING)
            approve("7", "ROLE_USER,ROLE_SELLER") shouldBe 403
            verify(exactly = 0) { sellers.save(any()) }
        }
        then("어드민은 200, 이미 승인된 판매자면 409") {
            every { sellers.findById(10L) } returns row(SellerStatus.PENDING)
            approve("1", "ROLE_ADMIN") shouldBe 200
            every { sellers.findById(10L) } returns row(SellerStatus.ACTIVE)
            approve("1", "ROLE_ADMIN") shouldBe 409
        }
        then("신원 헤더가 없으면 401") {
            approve(null, "ROLE_ADMIN") shouldBe 401
        }
    }
})
