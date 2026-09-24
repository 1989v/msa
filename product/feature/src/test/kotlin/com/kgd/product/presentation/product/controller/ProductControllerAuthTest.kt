package com.kgd.product.presentation.product.controller

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.application.product.service.ProductService
import com.kgd.product.application.product.service.ProductTransactionalService
import com.kgd.product.application.product.service.ProductWriteAuthorizer
import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import com.kgd.product.domain.product.model.ProductStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
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
import java.time.LocalDateTime

/**
 * 상품 쓰기 권한 — 게이트웨이가 ROLE_SELLER|ROLE_ADMIN 으로 좁힌 뒤 서비스가 한 번 더 본다.
 *
 * 컨트롤러부터 실제 [ProductService]·[ProductWriteAuthorizer] 까지 태운다 — 판정 근거는 응답 코드와
 * 저장 호출 여부다. 판매자 행이 생기기 전이라 판매자는 어떤 상품의 소유도 증명할 수 없어 403 이다.
 */
class ProductControllerAuthTest : BehaviorSpec({
    val transactionalService = mockk<ProductTransactionalService>()
    val eventPort = mockk<ProductEventPort>(relaxed = true)
    val service = ProductService(transactionalService, eventPort, ProductWriteAuthorizer())
    val controller = ProductController(service, service, service, service)
    val mockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(ProductExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    val product = Product.restore(1L, "상품", Money(1000.toBigDecimal()), 10, ProductStatus.ACTIVE, LocalDateTime.now())

    beforeEach {
        clearMocks(transactionalService, eventPort)
        every { transactionalService.save(any()) } returns product
        every { transactionalService.findById(1L) } returns product
    }

    fun MockHttpServletRequestBuilder.identity(userId: String?, roles: String?) = apply {
        userId?.let { header("X-User-Id", it) }
        roles?.let { header("X-User-Roles", it) }
    }

    fun create(userId: String?, roles: String?): Int = mockMvc.perform(
        MockMvcRequestBuilders.post("/api/v1/products")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"name":"상품","price":1000,"stock":10}""")
            .identity(userId, roles),
    ).andReturn().response.status

    fun update(userId: String?, roles: String?): Int = mockMvc.perform(
        MockMvcRequestBuilders.put("/api/v1/products/1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""{"name":"수정"}""")
            .identity(userId, roles),
    ).andReturn().response.status

    given("판매자도 어드민도 아닌 사용자") {
        then("등록은 403 이고 저장하지 않는다") {
            create("7", "ROLE_USER") shouldBe 403
            verify(exactly = 0) { transactionalService.save(any()) }
        }
    }

    given("판매자가 남의 상품을 고치려 하면") {
        then("403 이고 저장하지 않는다") {
            update("8", "ROLE_SELLER") shouldBe 403
            verify(exactly = 0) { transactionalService.save(any()) }
        }
    }

    given("어드민") {
        then("등록은 201") {
            create("1", "ROLE_USER,ROLE_ADMIN") shouldBe 201
            verify(exactly = 1) { transactionalService.save(any()) }
        }
        then("수정은 200") {
            update("1", "ROLE_ADMIN") shouldBe 200
            verify(exactly = 1) { transactionalService.save(any()) }
        }
    }

    given("신원 헤더가 없는 요청") {
        then("X-User-Id 가 없으면 역할 헤더가 있어도 401 — 허용으로 떨어지지 않는다") {
            create(null, "ROLE_ADMIN") shouldBe 401
            update(null, "ROLE_ADMIN") shouldBe 401
            verify(exactly = 0) { transactionalService.save(any()) }
        }
        then("역할 헤더가 없으면 403") {
            create("1", null) shouldBe 403
            verify(exactly = 0) { transactionalService.save(any()) }
        }
    }

    given("조회") {
        then("신원 없이도 200 — 탐색은 공개다") {
            mockMvc.perform(MockMvcRequestBuilders.get("/api/v1/products/1"))
                .andReturn().response.status shouldBe 200
        }
    }

    given("옛 경로") {
        then("/api/products 는 더 이상 없다 — 브리지를 두지 않는다") {
            mockMvc.perform(MockMvcRequestBuilders.get("/api/products/1"))
                .andReturn().response.status shouldBe 404
        }
    }
})
