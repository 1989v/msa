package com.kgd.fulfillment.presentation.fulfillment.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.GetFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.TransitionFulfillmentUseCase
import com.kgd.fulfillment.application.ownership.InMemoryOwnershipRepository
import com.kgd.fulfillment.application.ownership.service.FulfillmentAccessAuthorizer
import com.kgd.fulfillment.application.ownership.service.FulfillmentOwnershipSyncService
import com.kgd.fulfillment.application.ownership.usecase.SyncOwnershipUseCase
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.time.LocalDateTime

/**
 * 이행 REST 소유 — 전이는 라인 전부가 자기 상품인 판매자만, 어드민은 전부, 신원 없으면 401.
 * 판정 근거는 응답 코드와 전이 유스케이스 호출 여부다.
 */
class FulfillmentControllerOwnershipTest : BehaviorSpec({
    val create = mockk<CreateFulfillmentUseCase>()
    val transition = mockk<TransitionFulfillmentUseCase>()
    val get = mockk<GetFulfillmentUseCase>()
    val fulfillments = mockk<FulfillmentRepositoryPort>()
    val ownership = InMemoryOwnershipRepository()
    val sync = FulfillmentOwnershipSyncService(ownership)
    val controller = FulfillmentController(create, transition, get, FulfillmentAccessAuthorizer(fulfillments, ownership))
    val mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()
    val t0 = Instant.parse("2026-09-25T00:00:00Z")

    fun fulfillment(id: Long, vararg productIds: Long) = FulfillmentOrder.restore(
        id, 77L, 1L, FulfillmentStatus.PENDING, LocalDateTime.now(),
        FulfillmentOrder.create(77L, 1L, productIds.map { it to 1 }).getLines(),
    )

    beforeEach {
        clearMocks(create, transition, get, fulfillments)
        ownership.clear()
        // 판매자 A(회원 501) 상품 100, 판매자 B(회원 502) 상품 200
        sync.syncSeller(SyncOwnershipUseCase.Seller(10L, "501", "ACTIVE", t0))
        sync.syncSeller(SyncOwnershipUseCase.Seller(20L, "502", "ACTIVE", t0))
        sync.syncProduct(SyncOwnershipUseCase.Product(100L, 10L, t0))
        sync.syncProduct(SyncOwnershipUseCase.Product(200L, 20L, t0))
        every { fulfillments.findById(1L) } returns fulfillment(1L, 100L)
        every { fulfillments.findById(2L) } returns fulfillment(2L, 200L)
        every { fulfillments.findById(3L) } returns fulfillment(3L, 100L, 200L)
        every { transition.execute(any()) } answers {
            TransitionFulfillmentUseCase.Result(firstArg<TransitionFulfillmentUseCase.Command>().fulfillmentId, 77L, "PENDING", "PICKING")
        }
    }

    fun transitionStatus(id: Long, userId: String?, roles: String?): Int = mockMvc.perform(
        MockMvcRequestBuilders.patch("/api/fulfillments/$id/transition")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"targetStatus":"PICKING"}""")
            .apply { userId?.let { header("X-User-Id", it) } }
            .apply { roles?.let { header("X-User-Roles", it) } },
    ).andReturn().response.status

    given("판매자 A 가 이행을 전이하면") {
        then("B 의 상품 이행은 403 이고 전이하지 않는다") {
            transitionStatus(2L, "501", "ROLE_SELLER") shouldBe 403
            verify(exactly = 0) { transition.execute(any()) }
        }
        then("B 의 상품이 섞인 이행도 403") {
            transitionStatus(3L, "501", "ROLE_SELLER") shouldBe 403
            verify(exactly = 0) { transition.execute(any()) }
        }
        then("자기 상품뿐인 이행은 200") {
            transitionStatus(1L, "501", "ROLE_SELLER") shouldBe 200
            verify(exactly = 1) { transition.execute(TransitionFulfillmentUseCase.Command(1L, "PICKING")) }
        }
    }

    given("어드민") {
        then("남의 상품 이행도 200") {
            transitionStatus(2L, "1", "ROLE_ADMIN") shouldBe 200
        }
    }

    given("신원 헤더가 없으면") {
        then("401") {
            transitionStatus(1L, null, null) shouldBe 401
        }
    }

    given("이행 생성") {
        then("판매자는 403 — 소유를 판정할 라인이 없다") {
            mockMvc.perform(
                MockMvcRequestBuilders.post("/api/fulfillments")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"orderId":77,"warehouseId":1}""")
                    .header("X-User-Id", "501").header("X-User-Roles", "ROLE_SELLER"),
            ).andReturn().response.status shouldBe 403
            verify(exactly = 0) { create.execute(any()) }
        }
    }

    given("주문의 이행 목록") {
        then("판매자에게는 자기 상품 라인이 있는 이행만 보인다") {
            every { fulfillments.findAllByOrderId(77L) } returns listOf(fulfillment(1L, 100L), fulfillment(2L, 200L))
            every { get.findAllByOrderId(77L) } returns listOf(1L, 2L).map {
                GetFulfillmentUseCase.Result(it, 77L, 1L, "PENDING", LocalDateTime.now())
            }
            val body = mockMvc.perform(
                MockMvcRequestBuilders.get("/api/fulfillments/orders/77/all").header("X-User-Id", "501").header("X-User-Roles", "ROLE_SELLER"),
            ).andReturn().response.contentAsString
            val data = jacksonMapperBuilder().build().readTree(body).get("data")
            val ids = (0 until data.size()).map { data.get(it).get("fulfillmentId").asLong() }
            ids shouldBe listOf(1L)
        }
    }
})
