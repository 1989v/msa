package com.kgd.product.presentation.product.controller

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.application.product.service.ProductService
import com.kgd.product.application.product.service.ProductTransactionalService
import com.kgd.product.application.product.service.ProductWriteAuthorizer
import com.kgd.product.application.seller.InMemoryProductSellerRepository
import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import com.kgd.product.domain.product.model.ProductStatus
import com.kgd.product.domain.seller.model.ProductSeller
import com.kgd.product.domain.seller.model.ProductSellerStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.data.domain.PageImpl
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.time.LocalDateTime

/**
 * 판매자 소유 — 토큰의 ROLE_SELLER 가 아니라 판매자 읽기 모델의 ACTIVE 행이 판정한다.
 *
 * 컨트롤러부터 실제 [ProductService]·[ProductWriteAuthorizer] 까지 태운다. 판정 근거는 응답 코드와
 * 저장소에 넘어간 상품의 sellerId 다.
 */
class ProductControllerSellerOwnershipTest : BehaviorSpec({
    val transactionalService = mockk<ProductTransactionalService>()
    val eventPort = mockk<ProductEventPort>(relaxed = true)
    val sellers = InMemoryProductSellerRepository()
    val service = ProductService(transactionalService, eventPort, ProductWriteAuthorizer(sellers))
    val mockMvc = MockMvcBuilders.standaloneSetup(ProductController(service, service, service, service))
        .setControllerAdvice(ProductExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    fun productOf(sellerId: Long) =
        Product.restore(1L, "상품", Money(1000.toBigDecimal()), 10, ProductStatus.ACTIVE, LocalDateTime.now(), sellerId = sellerId)

    fun seller(sellerId: Long, memberId: String, status: ProductSellerStatus) =
        sellers.save(ProductSeller(sellerId, memberId, status, Instant.parse("2026-09-24T00:00:00Z")))

    val saved = slot<Product>()

    beforeEach {
        clearMocks(transactionalService, eventPort)
        sellers.clear()
        saved.clear()
        // 저장된 그대로 돌려준다 — 응답의 sellerId 가 저장된 값에서 온다
        every { transactionalService.save(capture(saved)) } answers {
            val p = saved.captured
            Product.restore(p.id ?: 100L, p.name, p.price, p.stock, p.status, p.createdAt, sellerId = p.sellerId)
        }
    }

    fun create(userId: String, roles: String, body: String = """{"name":"상품","price":1000,"stock":10}""") =
        mockMvc.perform(
            MockMvcRequestBuilders.post("/api/v1/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .header("X-User-Id", userId)
                .header("X-User-Roles", roles),
        ).andReturn().response

    fun update(userId: String, roles: String) = mockMvc.perform(
        MockMvcRequestBuilders.put("/api/v1/products/1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"name":"수정"}""")
            .header("X-User-Id", userId)
            .header("X-User-Roles", roles),
    ).andReturn().response.status

    given("ACTIVE 판매자가 상품을 등록하면") {
        then("seller_id 는 본문이 아니라 판매자 행에서 온다 — 본문의 sellerId 는 무시된다") {
            seller(7L, "501", ProductSellerStatus.ACTIVE)

            val response = create("501", "ROLE_USER,ROLE_SELLER", """{"name":"상품","price":1000,"stock":10,"sellerId":999}""")

            response.status shouldBe 201
            saved.captured.sellerId shouldBe 7L
            response.contentAsString.contains("\"sellerId\":7") shouldBe true
        }
    }

    given("정지된 판매자 — 토큰에는 아직 ROLE_SELLER 가 있다") {
        then("등록도 자기 상품 수정도 403 이고 저장하지 않는다") {
            seller(7L, "501", ProductSellerStatus.SUSPENDED)
            every { transactionalService.findById(1L) } returns productOf(7L)

            create("501", "ROLE_SELLER").status shouldBe 403
            update("501", "ROLE_SELLER") shouldBe 403
            verify(exactly = 0) { transactionalService.save(any()) }
        }
    }

    given("ACTIVE 판매자가 상품을 수정하면") {
        then("남의 상품은 403") {
            seller(7L, "501", ProductSellerStatus.ACTIVE)
            every { transactionalService.findById(1L) } returns productOf(8L)

            update("501", "ROLE_SELLER") shouldBe 403
            verify(exactly = 0) { transactionalService.save(any()) }
        }
        then("자기 상품은 200 이고 소유는 바뀌지 않는다") {
            seller(7L, "501", ProductSellerStatus.ACTIVE)
            every { transactionalService.findById(1L) } returns productOf(7L)

            update("501", "ROLE_SELLER") shouldBe 200
            saved.captured.sellerId shouldBe 7L
        }
    }

    given("판매자 행이 있어도 토큰에 ROLE_SELLER 가 없으면") {
        then("403 — 역할과 행을 둘 다 본다") {
            seller(7L, "501", ProductSellerStatus.ACTIVE)
            create("501", "ROLE_USER").status shouldBe 403
        }
    }

    given("목록 조회 ?sellerId=") {
        then("판매자 필터가 저장소 질의까지 넘어가고, 없으면 거르지 않는다") {
            every { transactionalService.findAll(any(), any()) } returns PageImpl(listOf(productOf(7L)))

            mockMvc.perform(MockMvcRequestBuilders.get("/api/v1/products").param("sellerId", "7"))
                .andReturn().response.status shouldBe 200
            verify(exactly = 1) { transactionalService.findAll(any(), 7L) }

            mockMvc.perform(MockMvcRequestBuilders.get("/api/v1/products"))
                .andReturn().response.status shouldBe 200
            verify(exactly = 1) { transactionalService.findAll(any(), null) }
        }
    }

    given("어드민") {
        then("남의 상품 수정도 200") {
            every { transactionalService.findById(1L) } returns productOf(8L)
            update("1", "ROLE_ADMIN") shouldBe 200
            saved.captured.sellerId shouldBe 8L
        }
        then("판매자 행이 없는 어드민이 등록하면 플랫폼 기본 판매자(1)") {
            create("1", "ROLE_ADMIN").status shouldBe 201
            saved.captured.sellerId shouldBe Product.PLATFORM_SELLER_ID
        }
    }
})
