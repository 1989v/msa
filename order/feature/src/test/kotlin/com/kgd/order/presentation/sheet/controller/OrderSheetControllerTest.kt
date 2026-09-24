package com.kgd.order.presentation.sheet.controller

import com.kgd.order.application.sheet.service.OrderSheetService
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import com.kgd.order.domain.cart.model.CartItem
import com.kgd.order.presentation.sheet.dto.CreateOrderSheetRequest
import com.kgd.order.presentation.sheet.dto.OrderSheetItemRequest
import com.kgd.order.support.InMemoryOrderPorts
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.databind.DeserializationFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.reflect.full.memberProperties

/**
 * 주문서 API — 컨트롤러 + 실제 서비스 + 메모리 저장소. 판정은 응답 코드와 **저장된 주문서 값**으로 한다.
 * 매퍼는 Boot 기본(모르는 필드 무시)과 같게 둔다 — 실제 Boot 매퍼 확인은 commerce 통합 spec 이 한다.
 */
class OrderSheetControllerTest : BehaviorSpec({

    val now = Instant.parse("2026-10-10T00:00:00Z")
    val old = Instant.parse("2026-01-01T00:00:00Z")

    fun setup(): Pair<InMemoryOrderPorts, MockMvc> {
        val ports = InMemoryOrderPorts()
        ports.sellers.save(SellerView(1L, "ACTIVE", 0, 0L, old))
        ports.sellers.save(SellerView(7L, "ACTIVE", 1_200, 3_000L, old))
        ports.sellers.save(SellerView(8L, "SUSPENDED", 1_000, 2_500L, old))
        ports.products.save(ProductView(101L, "머그", 12_000L, "ACTIVE", 7L, old))
        ports.products.save(ProductView(103L, "플랫폼 상품", 20_000L, "ACTIVE", 1L, old))
        ports.products.save(ProductView(104L, "정지 판매자 상품", 5_000L, "ACTIVE", 8L, old))
        val service = OrderSheetService(
            ports.sheets, ports.carts, ports.products, ports.sellers, ports.couponDefinitions, ports.userCoupons, ports.points,
            Clock.fixed(now, ZoneOffset.UTC), 15L,
        )
        val mapper = jacksonMapperBuilder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build()
        val mvc = MockMvcBuilders.standaloneSetup(OrderSheetController(service, service))
            .setMessageConverters(JacksonJsonHttpMessageConverter(mapper))
            .build()
        return ports to mvc
    }

    fun MockMvc.create(body: String, userId: String? = "m-1") = perform(
        post("/api/v1/order-sheets").contentType(MediaType.APPLICATION_JSON).content(body)
            .apply { userId?.let { header("X-User-Id", it) } },
    ).andReturn().response

    given("요청 JSON 에 가격·금액 필드를 넣어도") {
        val (ports, mvc) = setup()
        val response = mvc.create(
            """{"items":[{"productId":101,"quantity":2,"unitPrice":1,"price":1}],
               "unitPrice":1,"totalAmount":1,"payableAmount":1,"couponDiscount":99999}""",
        )
        then("201 이고 저장된 주문서 금액은 읽기 모델 가격 12,000 × 2 + 배송비 3,000") {
            response.status shouldBe 201
            val saved = ports.sheetRows.values.single()
            saved.lines.single().unitPrice shouldBe 12_000L
            saved.itemsAmount shouldBe 24_000L
            saved.couponDiscount shouldBe 0L
            saved.payableAmount shouldBe 27_000L
        }
        then("요청 DTO 에는 가격·금액 필드가 없다") {
            val names = CreateOrderSheetRequest::class.memberProperties.map { it.name } +
                OrderSheetItemRequest::class.memberProperties.map { it.name }
            names.filter { it.contains("price", ignoreCase = true) || it.contains("amount", ignoreCase = true) && it != "pointAmount" }
                .shouldBeEmpty()
        }
    }

    given("정지된 판매자의 상품") {
        val (ports, mvc) = setup()
        then("422 이고 주문서가 저장되지 않는다") {
            mvc.create("""{"items":[{"productId":101,"quantity":1},{"productId":104,"quantity":1}]}""").status shouldBe 422
            ports.sheetRows.size shouldBe 0
        }
    }

    given("신원 헤더") {
        val (ports, mvc) = setup()
        then("X-User-Id 가 없으면 401") {
            mvc.create("""{"items":[{"productId":101,"quantity":1}]}""", userId = null).status shouldBe 401
            ports.sheetRows.size shouldBe 0
        }
    }

    given("주문서 조회") {
        val (_, mvc) = setup()
        mvc.create("""{"items":[{"productId":103,"quantity":1}]}""").status shouldBe 201
        fun status(userId: String?) = mvc.perform(get("/api/v1/order-sheets/1").apply { userId?.let { header("X-User-Id", it) } })
            .andReturn().response.status
        then("본인은 200") { status("m-1") shouldBe 200 }
        then("남의 주문서는 없는 주문서와 같은 404 — 존재를 흘리지 않는다") {
            status("m-2") shouldBe 404
            mvc.perform(get("/api/v1/order-sheets/999").header("X-User-Id", "m-2")).andReturn().response.status shouldBe 404
        }
        then("헤더가 없으면 401") { status(null) shouldBe 401 }
    }

    given("장바구니에서 만들기") {
        val (ports, mvc) = setup()
        ports.carts.save(CartItem("m-1", 103L, 2))
        ports.carts.save(CartItem("m-2", 101L, 5))
        then("내 장바구니 줄만 주문서 라인이 된다") {
            mvc.create("""{"fromCart":true}""").status shouldBe 201
            ports.sheetRows.values.single().lines.map { it.productId to it.quantity } shouldBe listOf(103L to 2)
        }
        then("items 와 fromCart 를 같이 주면 400") {
            mvc.create("""{"fromCart":true,"items":[{"productId":103,"quantity":1}]}""").status shouldBe 400
        }
    }
})
