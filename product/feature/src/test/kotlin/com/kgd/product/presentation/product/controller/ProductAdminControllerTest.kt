package com.kgd.product.presentation.product.controller

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.application.product.service.ProductRepublishService
import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import com.kgd.product.domain.product.model.ProductStatus
import com.kgd.product.infrastructure.messaging.ProductEventAdapter
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.LocalDateTime

/**
 * 상품 이벤트 재발행 — 어드민만, 판매 중지 상품까지 전부 `product.item.updated` 아웃박스 행으로.
 * 판정은 실제 이벤트 어댑터가 아웃박스에 넘긴 토픽·페이로드다(가격은 원 단위 정수).
 */
class ProductAdminControllerTest : BehaviorSpec({
    val mapper = jacksonMapperBuilder().build()
    val rows = mutableListOf<Pair<String, String>>()
    val outbox = object : OutboxPort {
        override fun save(aggregateType: String, aggregateId: Long, eventType: String, payload: String, partitionKey: String?, headers: Map<String, String>) {
            rows += eventType to payload
        }
    }
    val events = ProductEventAdapter(outbox, mapper, "product.item.created", "product.item.updated")
    val products = (1L..150L).map { id ->
        Product.restore(id, "상품$id", Money(1000 + id), 1,
            if (id % 2 == 0L) ProductStatus.INACTIVE else ProductStatus.ACTIVE, LocalDateTime.now())
    }
    val repository = mockk<ProductRepositoryPort>()
    every { repository.findAllIncludingInactive(any()) } answers {
        val p = firstArg<Pageable>()
        val content = products.drop(p.offset.toInt()).take(p.pageSize)
        PageImpl(content, p, products.size.toLong())
    }
    val mvc = MockMvcBuilders.standaloneSetup(ProductAdminController(ProductRepublishService(repository, events)))
        .setControllerAdvice(ProductExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(mapper))
        .build()

    fun republish(userId: String?, roles: String?) = mvc.perform(
        post("/api/v1/admin/products/republish").apply {
            userId?.let { header("X-User-Id", it) }
            roles?.let { header("X-User-Roles", it) }
        },
    ).andReturn().response

    given("상품 이벤트 재발행") {
        then("신원 헤더가 없으면 401, ROLE_USER·ROLE_SELLER 는 403 — 아웃박스 행 0") {
            republish(null, null).status shouldBe 401
            republish("7", "ROLE_USER,ROLE_SELLER").status shouldBe 403
            rows.size shouldBe 0
        }
        then("어드민은 판매 중지 상품까지 150건 전부 updated 행으로 (페이지 경계 100 을 넘어서)") {
            republish("1", "ROLE_ADMIN").status shouldBe 200
            rows.size shouldBe 150
            rows.map { it.first }.toSet() shouldBe setOf("product.item.updated")
            rows.map { mapper.readTree(it.second)["productId"].asLong() }.toSet() shouldBe (1L..150L).toSet()
            rows.count { mapper.readTree(it.second)["status"].asString() == "INACTIVE" } shouldBe 75
        }
        then("가격은 소수점 없는 원 단위 정수, occurredAt 이 실린다") {
            val first = mapper.readTree(rows.first().second)
            first["price"].isIntegralNumber shouldBe true
            first["price"].asLong() shouldBe 1_001L
            first["occurredAt"].isNull shouldBe false
        }
    }
})
