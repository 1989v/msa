package com.kgd.order.presentation.order.controller

import com.kgd.order.application.order.service.OrderPlacementService
import com.kgd.order.application.order.service.OrderQueryService
import com.kgd.order.application.saga.port.SagaCommand
import com.kgd.order.application.saga.service.OrderSagaCoordinator
import com.kgd.order.application.saga.usecase.InventoryAnswer
import com.kgd.order.application.saga.usecase.InventoryAnswerType
import com.kgd.order.application.saga.usecase.PromotionAnswer
import com.kgd.order.application.saga.usecase.PromotionAnswerType
import com.kgd.order.domain.idempotency.model.IdempotencyKey
import com.kgd.order.domain.order.model.OrderStatus
import com.kgd.order.domain.saga.model.SagaTiming
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetLine
import com.kgd.order.domain.sheet.model.ShippingLine
import com.kgd.order.support.InMemoryOrderPorts
import com.kgd.order.support.InMemorySagaWorld
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.databind.DeserializationFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

/**
 * 주문 접수 API — 컨트롤러 + 실제 접수 서비스·코디네이터 + 메모리 저장소. 판정은 응답 코드·본문과 **저장된 주문 수·명령**이다.
 */
class OrderControllerIdempotencyTest : BehaviorSpec({

    val now = Instant.parse("2026-10-10T00:00:00Z")

    class Fixture {
        val world = InMemorySagaWorld()
        val ports = InMemoryOrderPorts()
        val mapper = jacksonMapperBuilder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build()
        val clock: Clock = Clock.fixed(now, ZoneOffset.UTC)
        val coordinator = OrderSagaCoordinator(
            world.orders, world.sagas, world.commandPort, world.events, world.opsIssues, clock,
            SagaTiming(Duration.ofSeconds(60), Duration.ofMinutes(10), 10), world.transactionManager,
        )
        val placement = OrderPlacementService(world.orders, ports.sheets, world.keys, coordinator, mapper, clock, world.transactionManager, 3)
        val query = OrderQueryService(world.orders, world.sagas)
        val mvc: MockMvc = MockMvcBuilders.standaloneSetup(OrderController(placement, query, query, coordinator))
            .setMessageConverters(JacksonJsonHttpMessageConverter(mapper))
            .build()

        fun sheet(memberId: String = "m-1", expiresAt: Instant = now.plusSeconds(900)): Long = requireNotNull(
            ports.sheets.save(
                OrderSheet.create(
                    memberId = memberId,
                    lines = listOf(OrderSheetLine(1, 101L, "머그", 7L, 12_000L, 1, 0, null, 0, 1_200)),
                    shippingLines = listOf(ShippingLine(7L, 3_000L)), userCouponId = null, couponDefinitionId = null,
                    expiresAt = expiresAt, createdAt = now.minusSeconds(60),
                ),
            ).id,
        )

        fun place(sheetId: Long, key: String? = "k-1", userId: String? = "m-1"): MockHttpServletResponse = mvc.perform(
            post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content("""{"orderSheetId":$sheetId}""")
                .apply { key?.let { header("Idempotency-Key", it) } }
                .apply { userId?.let { header("X-User-Id", it) } },
        ).andReturn().response

        fun get(orderId: Long, userId: String = "m-1"): MockHttpServletResponse =
            mvc.perform(get("/api/v1/orders/$orderId").header("X-User-Id", userId)).andReturn().response

        fun cancel(orderId: Long, userId: String = "m-1"): MockHttpServletResponse =
            mvc.perform(post("/api/v1/orders/$orderId/cancel").header("X-User-Id", userId)).andReturn().response
    }

    given("Idempotency-Key") {
        then("처음 요청 → 202 + Location, 주문 1건 · 사가 시작(재고 예약 명령)") {
            val f = Fixture()
            val r = f.place(f.sheet())
            r.status shouldBe 202
            r.getHeader("Location") shouldBe "/api/v1/orders/1"
            r.contentAsString shouldContain "\"status\":\"CREATED\""
            r.contentAsString shouldContain "\"sagaStep\":\"INVENTORY_RESERVE\""
            f.world.orderCount() shouldBe 1
            f.world.commands.single()::class shouldBe SagaCommand.ReserveInventory::class
        }
        then("완료 뒤 같은 키 → 처음 응답 그대로(본문·Location), 주문은 여전히 1건") {
            val f = Fixture()
            val sheetId = f.sheet()
            val first = f.place(sheetId)
            // 그 사이 사가가 진행돼 주문 상태가 바뀌어도 저장한 응답을 돌려준다
            f.coordinator.onInventory(InventoryAnswer(1L, InventoryAnswerType.RESERVED, "RESERVE"))
            f.coordinator.onPromotion(PromotionAnswer(1L, PromotionAnswerType.RESERVED, "RESERVE"))
            val second = f.place(sheetId)
            second.status shouldBe 202
            second.contentAsString shouldBe first.contentAsString
            second.getHeader("Location") shouldBe first.getHeader("Location")
            f.world.orderCount() shouldBe 1
        }
        then("처리 중(리스 유효) 같은 키 → 409, 주문 0건") {
            val f = Fixture()
            f.world.putKey(IdempotencyKey.begin("m-1", "k-1", now.minusSeconds(10)))
            f.place(f.sheet()).status shouldBe 409
            f.world.orderCount() shouldBe 0
        }
        then("리스(60초)가 지난 처리 중 키 → 이어받아 202, 주문 1건") {
            val f = Fixture()
            f.world.putKey(IdempotencyKey.begin("m-1", "k-1", now.minusSeconds(61)))
            f.place(f.sheet()).status shouldBe 202
            f.world.orderCount() shouldBe 1
        }
        then("처리가 실패하면(422) 키를 풀어 같은 키로 다시 시도할 수 있다") {
            val f = Fixture()
            f.place(f.sheet(expiresAt = now)).status shouldBe 422
            f.world.key("m-1", "k-1") shouldBe null
            f.place(f.sheet()).status shouldBe 202
        }
        then("키가 없으면 400, 신원 헤더가 없으면 401 — 주문 0건") {
            val f = Fixture()
            f.place(f.sheet(), key = null).status shouldBe 400
            f.place(f.sheet(), userId = null).status shouldBe 401
            f.world.orderCount() shouldBe 0
        }
    }

    given("주문서 검증") {
        then("만료 · 이미 쓰임 · 남의 주문서 → 422") {
            val f = Fixture()
            f.place(f.sheet(expiresAt = now), key = "a").status shouldBe 422
            val used = f.sheet()
            f.place(used, key = "b").status shouldBe 202
            f.place(used, key = "c").status shouldBe 422
            f.place(f.sheet(memberId = "someone-else"), key = "d").status shouldBe 422
            f.world.orderCount() shouldBe 1
        }
    }

    given("결제 대기 상한") {
        then("CREATED · PAYMENT_PENDING 이 3건이면 4번째는 429") {
            val f = Fixture()
            repeat(3) { i -> f.place(f.sheet(), key = "k$i").status shouldBe 202 }
            f.place(f.sheet(), key = "k4").status shouldBe 429
            f.world.orderCount() shouldBe 3
        }
    }

    given("조회 · 취소") {
        then("본인은 상태·사가 단계·실패 사유를 받고 남은 404") {
            val f = Fixture()
            f.place(f.sheet())
            f.get(1L).let {
                it.status shouldBe 200
                it.contentAsString shouldContain "\"sagaStep\":\"INVENTORY_RESERVE\""
                it.contentAsString shouldContain "\"payableAmount\":15000"
            }
            f.get(1L, userId = "other").status shouldBe 404
        }
        then("PAYMENT_PENDING 취소 → 409, 보상 명령 없음") {
            val f = Fixture()
            f.place(f.sheet())
            f.coordinator.onInventory(InventoryAnswer(1L, InventoryAnswerType.RESERVED, "RESERVE"))
            f.coordinator.onPromotion(PromotionAnswer(1L, PromotionAnswerType.RESERVED, "RESERVE"))
            f.world.order(1L).status shouldBe OrderStatus.PAYMENT_PENDING
            val before = f.world.commands.size
            f.cancel(1L).status shouldBe 409
            f.world.commands.size shouldBe before
        }
        then("CREATED 취소 → 202, 보상 시작(재고 해제 명령)") {
            val f = Fixture()
            f.place(f.sheet())
            f.cancel(1L).status shouldBe 202
            f.world.commands.last()::class shouldBe SagaCommand.ReleaseInventory::class
        }
    }
})
