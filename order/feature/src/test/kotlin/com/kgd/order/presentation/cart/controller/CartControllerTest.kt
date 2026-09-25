package com.kgd.order.presentation.cart.controller

import com.kgd.order.application.cart.service.CartService
import com.kgd.order.domain.catalog.model.ProductView
import com.kgd.order.domain.catalog.model.SellerView
import com.kgd.order.support.InMemoryOrderPorts
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant

/** 장바구니 — 본인 것만, 헤더 없으면 401. 판매 불가 상품은 담기되 onSale=false 로 보인다 */
class CartControllerTest : BehaviorSpec({
    val old = Instant.parse("2026-01-01T00:00:00Z")
    val ports = InMemoryOrderPorts()
    ports.sellers.save(SellerView(7L, "ACTIVE", 1_200, 3_000L, old, businessName = "도자기 공방"))
    ports.sellers.save(SellerView(8L, "SUSPENDED", 1_000, 0L, old))
    ports.products.save(ProductView(101L, "머그", 12_000L, "ACTIVE", 7L, old))
    ports.products.save(ProductView(104L, "정지 판매자 상품", 5_000L, "ACTIVE", 8L, old))
    val mvc = MockMvcBuilders.standaloneSetup(CartController(CartService(ports.carts, ports.products, ports.sellers)))
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    fun putItem(productId: Long, qty: Int, userId: String?) = mvc.perform(
        put("/api/v1/cart/items/$productId").contentType(MediaType.APPLICATION_JSON).content("""{"quantity":$qty}""")
            .apply { userId?.let { header("X-User-Id", it) } },
    ).andReturn().response

    given("장바구니") {
        then("헤더 없으면 401, 행이 생기지 않는다") {
            putItem(101L, 1, null).status shouldBe 401
            mvc.perform(get("/api/v1/cart")).andReturn().response.status shouldBe 401
            ports.cartRows.size shouldBe 0
        }
        then("담고 수량을 바꾸면 한 줄") {
            putItem(101L, 1, "m-1").status shouldBe 200
            putItem(101L, 3, "m-1").status shouldBe 200
            ports.cartRows.filter { it.memberId == "m-1" }.map { it.productId to it.quantity } shouldBe listOf(101L to 3)
        }
        then("판매자 상호를 싣는다 — 읽기 모델에 상호가 없으면 null") {
            val body = putItem(101L, 1, "m-3").contentAsString
            body shouldContain """"sellerId":7,"onSale":true,"sellerName":"도자기 공방""""
            putItem(104L, 1, "m-3").contentAsString shouldContain """"sellerId":8,"onSale":false,"sellerName":null"""
        }
        then("읽기 모델에 없는 상품은 404") { putItem(999L, 1, "m-1").status shouldBe 404 }
        then("수량 0 은 400") { putItem(101L, 0, "m-1").status shouldBe 400 }
        then("정지 판매자 상품은 onSale=false") {
            putItem(104L, 1, "m-1").contentAsString shouldContain """"productId":104,"quantity":1,"productName":"정지 판매자 상품","price":5000,"sellerId":8,"onSale":false"""
        }
        then("남의 장바구니는 보이지 않는다") {
            putItem(101L, 2, "m-2")
            val mine = mvc.perform(get("/api/v1/cart").header("X-User-Id", "m-2")).andReturn().response.contentAsString
            mine shouldContain """"productId":101,"quantity":2"""
            mine shouldNotContain "\"productId\":104"
        }
        then("빼기") {
            mvc.perform(delete("/api/v1/cart/items/104").header("X-User-Id", "m-1")).andReturn().response.status shouldBe 200
            ports.cartRows.filter { it.memberId == "m-1" }.map { it.productId } shouldBe listOf(101L)
        }
    }
})
