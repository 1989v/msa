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
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
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
    val mockMvc = MockMvcBuilders.standaloneSetup(ProductController(service, service, service, service, service), SellerProductController(service))
        .setControllerAdvice(ProductExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    fun productOf(sellerId: Long) =
        Product.restore(1L, "상품", Money(1000L), 10, ProductStatus.ACTIVE, LocalDateTime.now(), sellerId = sellerId)

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

    given("ACTIVE 판매자 행이 있는 어드민이 등록하면") {
        then("그래도 플랫폼 기본 판매자(1) 소유다 — 어드민 등록은 개인 판매자 매출이 아니다") {
            seller(7L, "1", ProductSellerStatus.ACTIVE)
            create("1", "ROLE_ADMIN,ROLE_SELLER").status shouldBe 201
            saved.captured.sellerId shouldBe Product.PLATFORM_SELLER_ID
        }
    }

    given("판매 중지 DELETE /api/v1/products/{id}") {
        fun stop(userId: String, roles: String) = mockMvc.perform(
            MockMvcRequestBuilders.delete("/api/v1/products/1").header("X-User-Id", userId).header("X-User-Roles", roles),
        ).andReturn().response

        then("어드민은 200 — 행을 지우지 않고 INACTIVE 로 저장하고 갱신 이벤트를 낸다") {
            every { transactionalService.findById(1L) } returns productOf(7L)
            val response = stop("1", "ROLE_ADMIN")
            response.status shouldBe 200
            saved.captured.status shouldBe ProductStatus.INACTIVE
            response.contentAsString.contains("\"status\":\"INACTIVE\"") shouldBe true
            verify(exactly = 1) { eventPort.publishProductUpdated(match { it.status == ProductStatus.INACTIVE }) }
        }
        then("이미 중지된 상품이면 저장·이벤트 없이 200") {
            every { transactionalService.findById(1L) } returns
                Product.restore(1L, "상품", Money(1000L), 10, ProductStatus.INACTIVE, LocalDateTime.now(), sellerId = 7L)
            stop("1", "ROLE_ADMIN").status shouldBe 200
            verify(exactly = 0) { transactionalService.save(any()) }
            verify(exactly = 0) { eventPort.publishProductUpdated(any()) }
        }
        then("판매자는 자기 상품이어도 403") {
            seller(7L, "501", ProductSellerStatus.ACTIVE)
            every { transactionalService.findById(1L) } returns productOf(7L)
            stop("501", "ROLE_SELLER").status shouldBe 403
            verify(exactly = 0) { transactionalService.save(any()) }
        }
    }

    given("판매자 포털 내 상품 GET /api/v1/seller/products") {
        then("요청자의 판매자 id 로, 최근 등록순(id 내림차순) 질의한다 — 판매 중지 상품도 응답에 상태와 함께 실린다") {
            seller(7L, "501", ProductSellerStatus.ACTIVE)
            val pageable = slot<Pageable>()
            every { transactionalService.findAllBySeller(capture(pageable), 7L) } returns PageImpl(
                listOf(Product.restore(2L, "중지", Money(1000L), 0, ProductStatus.INACTIVE, LocalDateTime.now(), sellerId = 7L)),
            )
            val response = mockMvc.perform(
                MockMvcRequestBuilders.get("/api/v1/seller/products").param("sellerId", "8")
                    .header("X-User-Id", "501").header("X-User-Roles", "ROLE_SELLER"),
            ).andReturn().response
            response.status shouldBe 200
            response.contentAsString.contains("\"status\":\"INACTIVE\"") shouldBe true
            pageable.captured.sort shouldBe Sort.by("id").descending()
            verify(exactly = 0) { transactionalService.findAllBySeller(any(), 8L) }
        }
        then("판매자 행이 없는 어드민은 403") {
            mockMvc.perform(
                MockMvcRequestBuilders.get("/api/v1/seller/products").header("X-User-Id", "1").header("X-User-Roles", "ROLE_ADMIN"),
            ).andReturn().response.status shouldBe 403
        }
    }

    given("가격은 원 단위 정수") {
        then("소수부가 0 인 값은 받아 정수로 저장하고, 응답 가격도 소수점 없는 정수다") {
            val response = create("1", "ROLE_ADMIN", """{"name":"상품","price":12900.00,"stock":10}""")

            response.status shouldBe 201
            saved.captured.price.amount shouldBe 12_900L
            val price = jacksonMapperBuilder().build().readTree(response.contentAsString).findValue("price")
            price.isIntegralNumber shouldBe true
            price.asLong() shouldBe 12_900L
        }
        then("소수 원이 있으면 등록·수정 모두 400 이고 저장하지 않는다 — 잘라서 받지 않는다") {
            every { transactionalService.findById(1L) } returns productOf(8L)

            create("1", "ROLE_ADMIN", """{"name":"상품","price":1000.5,"stock":10}""").status shouldBe 400
            mockMvc.perform(
                MockMvcRequestBuilders.put("/api/v1/products/1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"price":99.9}""")
                    .header("X-User-Id", "1")
                    .header("X-User-Roles", "ROLE_ADMIN"),
            ).andReturn().response.status shouldBe 400
            verify(exactly = 0) { transactionalService.save(any()) }
        }
    }
})
