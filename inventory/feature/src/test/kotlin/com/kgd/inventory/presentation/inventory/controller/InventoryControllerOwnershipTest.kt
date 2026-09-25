package com.kgd.inventory.presentation.inventory.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.GetInventoryUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.application.ownership.InMemoryOwnershipRepository
import com.kgd.inventory.application.ownership.service.InventoryAccessAuthorizer
import com.kgd.inventory.application.ownership.service.InventoryOwnershipSyncService
import com.kgd.inventory.application.ownership.usecase.SyncOwnershipUseCase
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

/**
 * 재고 REST 소유 — 판매자는 자기 상품 재고만, 어드민은 전부, 신원 없으면 401.
 * 읽기 모델은 실제 [InventoryOwnershipSyncService] 로 채우고(이벤트 반영 경로), 판정 근거는 응답 코드와 유스케이스 호출 여부다.
 */
class InventoryControllerOwnershipTest : BehaviorSpec({
    val receive = mockk<ReceiveStockUseCase>()
    val get = mockk<GetInventoryUseCase>()
    val ownership = InMemoryOwnershipRepository()
    val sync = InventoryOwnershipSyncService(ownership)
    val controller = InventoryController(
        mockk<ReserveStockUseCase>(), mockk<ReleaseStockUseCase>(), mockk<ConfirmStockUseCase>(),
        receive, get, InventoryAccessAuthorizer(ownership),
    )
    val mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()
    val t0 = Instant.parse("2026-09-25T00:00:00Z")

    beforeEach {
        clearMocks(receive, get)
        ownership.clear()
        // 판매자 A(회원 501) · B(회원 502), 상품 100 은 A, 200 은 B
        sync.syncSeller(SyncOwnershipUseCase.Seller(10L, "501", "ACTIVE", t0))
        sync.syncSeller(SyncOwnershipUseCase.Seller(20L, "502", "ACTIVE", t0))
        sync.syncProduct(SyncOwnershipUseCase.Product(100L, 10L, t0))
        sync.syncProduct(SyncOwnershipUseCase.Product(200L, 20L, t0))
        every { receive.execute(any()) } answers { ReceiveStockUseCase.Result(firstArg<ReceiveStockUseCase.Command>().productId, 5) }
    }

    fun receiveStatus(productId: Long, userId: String?, roles: String?): Int = mockMvc.perform(
        MockMvcRequestBuilders.post("/api/inventories/receive")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"productId":$productId,"warehouseId":1,"qty":5}""")
            .apply { userId?.let { header("X-User-Id", it) } }
            .apply { roles?.let { header("X-User-Roles", it) } },
    ).andReturn().response.status

    given("판매자 A 가 입고하면") {
        then("B 의 상품은 403 이고 유스케이스를 부르지 않는다") {
            receiveStatus(200L, "501", "ROLE_USER,ROLE_SELLER") shouldBe 403
            verify(exactly = 0) { receive.execute(any()) }
        }
        then("자기 상품은 201") {
            receiveStatus(100L, "501", "ROLE_USER,ROLE_SELLER") shouldBe 201
            verify(exactly = 1) { receive.execute(ReceiveStockUseCase.Command(100L, 1L, 5)) }
        }
        then("소유를 모르는 상품(읽기 모델에 행 없음)은 403") {
            receiveStatus(999L, "501", "ROLE_SELLER") shouldBe 403
        }
    }

    given("정지 이벤트가 반영된 판매자 — 토큰에는 아직 ROLE_SELLER 가 있다") {
        then("자기 상품도 403") {
            sync.syncSeller(SyncOwnershipUseCase.Seller(10L, "501", "SUSPENDED", t0.plusSeconds(1)))
            receiveStatus(100L, "501", "ROLE_SELLER") shouldBe 403
        }
    }

    given("늦게 도착한 옛 판매자 이벤트") {
        then("최신 상태를 덮지 않는다 — 정지 뒤에 온 옛 승인은 무시") {
            sync.syncSeller(SyncOwnershipUseCase.Seller(10L, "501", "SUSPENDED", t0.plusSeconds(10)))
            sync.syncSeller(SyncOwnershipUseCase.Seller(10L, "501", "ACTIVE", t0.plusSeconds(5)))
            receiveStatus(100L, "501", "ROLE_SELLER") shouldBe 403
        }
    }

    given("어드민") {
        then("남의 상품도 201") {
            receiveStatus(200L, "1", "ROLE_ADMIN") shouldBe 201
        }
    }

    given("신원 헤더가 없으면") {
        then("401") {
            receiveStatus(100L, null, null) shouldBe 401
        }
    }

    given("재고 조회") {
        then("판매자는 남의 상품 403, 자기 상품 200") {
            every { get.execute(any()) } returns emptyList()
            mockMvc.perform(
                MockMvcRequestBuilders.get("/api/inventories/200").header("X-User-Id", "501").header("X-User-Roles", "ROLE_SELLER"),
            ).andReturn().response.status shouldBe 403
            mockMvc.perform(
                MockMvcRequestBuilders.get("/api/inventories/100").header("X-User-Id", "501").header("X-User-Roles", "ROLE_SELLER"),
            ).andReturn().response.status shouldBe 200
        }
    }
})
