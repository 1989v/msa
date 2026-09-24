package com.kgd.commerce.saga

import com.kgd.commerce.CommerceApplication
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.reservation.usecase.ExpireReservationsUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.application.sheet.usecase.CreateOrderSheetUseCase
import com.kgd.payment.infrastructure.pg.mock.MockPgCallRecorder
import com.kgd.payment.infrastructure.pg.mock.MockPgScenario.Outcome
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase
import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.application.hold.usecase.ExpirePromotionHoldsUseCase
import com.kgd.promotion.application.point.usecase.GrantPointsUseCase
import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponType
import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.application.seller.usecase.ManageSellerUseCase
import com.kgd.seller.domain.seller.model.SettlementCycle
import io.kotest.assertions.nondeterministic.continually
import io.kotest.assertions.nondeterministic.eventually
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContainInOrder
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.comparables.shouldBeGreaterThan
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import org.apache.kafka.clients.admin.AdminClient
import org.apache.kafka.clients.admin.AdminClientConfig
import org.apache.kafka.clients.admin.NewTopic
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.kafka.config.KafkaListenerEndpointRegistry
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.kafka.KafkaContainer
import org.testcontainers.utility.DockerImageName
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.sql.DataSource
import kotlin.reflect.KClass
import kotlin.time.Duration.Companion.seconds

/**
 * 주문 사가 E2E (스펙 SR-4). commerce 호스트 전체 + 실제 MySQL(모든 도메인 Flyway + validate) + 실제 Kafka.
 * 대체하는 것은 PG 하나 — 모의 PG 의 답을 [ScriptedMockPgScenario] 가 결제액별로 정한다. 코디네이터·명령 컨슈머·
 * 아웃박스 릴레이·스케줄러는 운영 그대로다.
 *
 * 데이터는 전부 유스케이스로 만든다(판매자 신청·승인 → 판매자 상품 → 입고 → 쿠폰 정의·발급 → 포인트 지급 → 주문서 → 접수).
 * 읽기 모델은 실제 Kafka 로 채워질 때까지 기다린다. 판정은 각 도메인 DB 행과 모의 PG 호출 기록이다.
 *
 * 시간: 결제 재조회 백오프(30초·1분)는 결제 시계([AdvancingClock])를 앞으로 돌려 넘긴다. 재고 예약은 시계 빈이 없어
 * (Reservation.isExpired 가 벽시계) 보류 만료는 기한 컬럼을 과거로 옮기고 만료 스케줄러 본문을 부른다.
 * 사가 기한은 2초 · 재시도 한도 4회로 줄였다(피벗 뒤 재시도·STUCK 을 수십 초 안에 보려고).
 */
@EnabledIf(OrderSagaE2ETest.DockerOrCi::class)
@SpringBootTest(
    classes = [CommerceApplication::class, SagaE2EConfig::class],
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.main.allow-bean-definition-overriding=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        "outbox.polling.interval-ms=100",
        "order.saga.step-timeout-seconds=2",
        "order.saga.max-retries=4",
        "order.saga.deadline-check-interval-ms=300",
        "order.saga.deadline-initial-delay-ms=0",
        "payment.inquiry.interval-ms=300",
        "payment.inquiry.initial-delay-ms=0",
        // 보류 만료는 테스트가 부른다 — 스케줄러가 끼어들면 (a)·(b) 의 도착 시점을 못 정한다
        "inventory.reservation.expiry-check-interval-ms=3600000",
        "promotion.hold-expiry.initial-delay-ms=3600000",
    ],
)
class OrderSagaE2ETest(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    private val orderJdbc = JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))
    private val inventoryJdbc = JdbcTemplate(ctx.getBean("masterDataSource", DataSource::class.java))
    private val paymentJdbc = JdbcTemplate(ctx.getBean("paymentMasterDataSource", DataSource::class.java))
    private val promotionJdbc = JdbcTemplate(ctx.getBean("promotionMasterDataSource", DataSource::class.java))
    private val fulfillmentJdbc = JdbcTemplate(ctx.getBean("fulfillmentMasterDataSource", DataSource::class.java))
    private val productJdbc = JdbcTemplate(ctx.getBean("productMasterDataSource", DataSource::class.java))

    private val scenario = ctx.getBean(ScriptedMockPgScenario::class.java)
    private val pgCalls = ctx.getBean(MockPgCallRecorder::class.java)
    private val paymentClock = ctx.getBean("paymentClock", AdvancingClock::class.java)
    private val createSheet = ctx.getBean(CreateOrderSheetUseCase::class.java)
    private val place = ctx.getBean(PlaceOrderUseCase::class.java)
    private val products = ctx.getBean(CreateProductUseCase::class.java)
    private val receiveStock = ctx.getBean(ReceiveStockUseCase::class.java)
    private val grantPoints = ctx.getBean(GrantPointsUseCase::class.java)
    private val claimCoupon = ctx.getBean(ClaimCouponUseCase::class.java)
    private val objectMapper = ctx.getBean(ObjectMapper::class.java)

    private val admin = ProductRequester("1", setOf("ROLE_ADMIN"))

    // ---- 조회 ----

    private fun order(id: Long) = orderJdbc.queryForMap("SELECT status, failure_reason FROM orders WHERE id = ?", id)
    private fun orderStatus(id: Long) = order(id)["status"] as String
    private fun history(id: Long) =
        orderJdbc.queryForList("SELECT to_status FROM order_status_history WHERE order_id = ? ORDER BY id", String::class.java, id)
    private fun saga(id: Long) = orderJdbc.queryForMap("SELECT status, step, attempts, next_deadline_at FROM order_saga WHERE order_id = ?", id)
    private fun payments(orderId: Long) = paymentJdbc.queryForList("SELECT status, void_requested_at FROM payment WHERE order_id = ?", orderId)
    private fun paymentStatus(orderId: Long) = payments(orderId).single()["status"] as String
    private fun holdStatus(orderId: Long) =
        promotionJdbc.queryForList("SELECT status FROM promotion_hold WHERE order_id = ?", String::class.java, orderId).singleOrNull()
    private fun reservationStatuses(orderId: Long) =
        inventoryJdbc.queryForList("SELECT status FROM reservation WHERE order_id = ?", String::class.java, orderId)
    private fun stock(productId: Long): Pair<Int, Int> =
        inventoryJdbc.queryForMap("SELECT available_qty, reserved_qty FROM inventory WHERE product_id = ?", productId)
            .let { (it["available_qty"] as Number).toInt() to (it["reserved_qty"] as Number).toInt() }
    private fun points(memberId: String) =
        promotionJdbc.queryForObject("SELECT balance FROM point_balance WHERE member_id = ?", Long::class.java, memberId)
    private fun orderNo(orderId: Long) = "ORD-$orderId-1"
    private fun pgKey(orderId: Long) = "mock-${orderNo(orderId)}"
    private fun calls(op: MockPgCallRecorder.Op, orderId: Long) =
        pgCalls.count(op, if (op == MockPgCallRecorder.Op.AUTHORIZE || op == MockPgCallRecorder.Op.INQUIRE) orderNo(orderId) else pgKey(orderId))
    private fun outboxCount(orderId: Long, type: String) = orderJdbc.queryForObject(
        "SELECT COUNT(*) FROM outbox_event WHERE aggregate_id = ? AND event_type = ?", Long::class.java, orderId, type,
    )

    // ---- 준비 (유스케이스로) ----

    /** 플랫폼(판매자 1, 배송비 0) 상품 + 창고 1 입고 — order 읽기 모델에 들어올 때까지 기다린다 */
    private fun product(name: String, price: Long, stock: Int, requester: ProductRequester = admin): Long {
        val id = products.execute(CreateProductUseCase.Command(name = name, price = price.toBigDecimal(), stock = stock), requester).id
        receiveStock.execute(ReceiveStockUseCase.Command(productId = id, warehouseId = 1L, qty = stock))
        awaitUntil("product_view $id") {
            orderJdbc.queryForList("SELECT price FROM product_view WHERE product_id = ?", Long::class.java, id).singleOrNull() == price
        }
        return id
    }

    private fun grant(memberId: String, amount: Long) {
        grantPoints.grant(GrantPointsUseCase.Grant(memberId, amount, "1", "사가 E2E"))
        awaitUntil("point_balance_view $memberId") {
            orderJdbc.queryForList("SELECT balance FROM point_balance_view WHERE member_id = ?", Long::class.java, memberId)
                .singleOrNull() == points(memberId)
        }
    }

    private fun claim(memberId: String, definitionId: Long): Long {
        val userCouponId = claimCoupon.claim(memberId, definitionId).userCouponId
        awaitUntil("user_coupon_view $userCouponId") {
            orderJdbc.queryForList("SELECT status FROM user_coupon_view WHERE user_coupon_id = ?", String::class.java, userCouponId)
                .singleOrNull() == "AVAILABLE"
        }
        return userCouponId
    }

    /** 주문서(유스케이스) → 접수(Idempotency-Key). 주문서 결제액이 대본을 건 금액과 같은지 먼저 확인한다 */
    private fun placeOrder(
        buyer: String,
        productId: Long,
        quantity: Int,
        expectedPayable: Long,
        userCouponId: Long? = null,
        pointAmount: Long = 0,
        key: String = UUID.randomUUID().toString(),
    ): Long {
        val sheet = createSheet.execute(
            CreateOrderSheetUseCase.Command(buyer, listOf(CreateOrderSheetUseCase.Item(productId, quantity)), false, userCouponId, pointAmount),
        )
        sheet.payableAmount shouldBe expectedPayable
        return place.place(PlaceOrderUseCase.Command(buyer, key, sheet.id)).orderId
    }

    /** 보류 만료 — 기한 컬럼을 과거로 옮긴다(재고 예약은 벽시계라 시계를 돌릴 수 없다) */
    private fun lapseReservation(orderId: Long) = inventoryJdbc.update(
        "UPDATE reservation SET expired_at = '2000-01-01 00:00:00' WHERE order_id = ? AND status = 'ACTIVE'", orderId,
    )

    private fun lapsePromotionHold(orderId: Long) = promotionJdbc.update(
        "UPDATE promotion_hold SET expires_at = '2000-01-01 00:00:00' WHERE order_id = ? AND status = 'RESERVED'", orderId,
    )

    init {
        var sellerProduct = 0L
        var couponDefinitionId = 0L

        Given("준비 — 리스너 할당 · 판매자 승인 · 쿠폰 정의") {
            Then("모든 리스너 컨테이너가 파티션을 받는다") {
                val registry = ctx.getBean(KafkaListenerEndpointRegistry::class.java)
                val topics = registry.listenerContainers.flatMap { it.containerProperties.topics.orEmpty().toList() }.toSet()
                createTopics(topics)
                awaitUntil("리스너 할당", timeoutSeconds = 90) {
                    registry.listenerContainers.filter { it.isRunning }.all { !it.assignedPartitions.isNullOrEmpty() }
                }
            }
            Then("판매자 신청 → 승인이 order·product 읽기 모델에 ACTIVE 로 들어오고, 그 판매자가 상품을 등록한다") {
                val seller = ctx.getBean(ApplySellerUseCase::class.java).execute(
                    ApplySellerUseCase.Command(
                        memberId = "e2e-seller", businessName = "사가 상점", businessRegistrationNo = "333-44-55555",
                        representativeName = "대표", bankName = "은행", accountNumber = "110-333-444555",
                        shippingFee = 3_000L, settlementCycle = SettlementCycle.WEEKLY,
                    ),
                )
                ctx.getBean(ManageSellerUseCase::class.java).approve(ManageSellerUseCase.Approve(seller.id, "1", 1_000, "사가 E2E"))
                awaitUntil("seller_view ${seller.id}") {
                    orderJdbc.queryForList("SELECT status FROM seller_view WHERE seller_id = ?", String::class.java, seller.id).singleOrNull() == "ACTIVE" &&
                        productJdbc.queryForList("SELECT status FROM product_seller WHERE seller_id = ?", String::class.java, seller.id).singleOrNull() == "ACTIVE"
                }
                sellerProduct = product("상점 찻잔", 12_000L, 10, ProductRequester("e2e-seller", setOf("ROLE_USER", "ROLE_SELLER")))
                orderJdbc.queryForObject("SELECT seller_id FROM product_view WHERE product_id = ?", Long::class.java, sellerProduct) shouldBe seller.id

                couponDefinitionId = ctx.getBean(ManageCouponDefinitionUseCase::class.java).create(
                    ManageCouponDefinitionUseCase.Create(
                        name = "사가 2천원", type = CouponType.FIXED, amount = 2_000L, rateBp = null, maxDiscount = null,
                        minOrderAmount = 0L, validFrom = Instant.now().minusSeconds(3_600), validUntil = Instant.now().plusSeconds(86_400),
                        issueLimit = 100, bearer = CouponBearer.PLATFORM, sellerId = null, actorId = "1",
                    ),
                ).id
            }
        }

        Given("1. 정상 — 판매자 상품 2개 · 쿠폰 2,000 · 포인트 1,000 · 배송비 3,000") {
            Then("사가 COMPLETED · 주문 CONFIRMED → FULFILLING · 예약 CONFIRMED · 결제 CAPTURED · 혜택 CONFIRMED · 이행 행 · 확정 이벤트") {
                val productId = sellerProduct
                val coupon = claim("e2e-happy", couponDefinitionId)
                grant("e2e-happy", 1_000L)
                val orderId = placeOrder("e2e-happy", productId, 2, 24_000L, userCouponId = coupon, pointAmount = 1_000L)

                eventually(10.seconds) {
                    saga(orderId)["status"] shouldBe "COMPLETED"
                    orderStatus(orderId) shouldBe "FULFILLING"
                }
                history(orderId) shouldContainInOrder listOf("CREATED", "PAYMENT_PENDING", "PAID", "CONFIRMED", "FULFILLING")
                reservationStatuses(orderId) shouldBe listOf("CONFIRMED")
                paymentStatus(orderId) shouldBe "CAPTURED"
                holdStatus(orderId) shouldBe "CONFIRMED"
                stock(productId) shouldBe (8 to 0)
                calls(MockPgCallRecorder.Op.AUTHORIZE, orderId) shouldBe 1
                calls(MockPgCallRecorder.Op.CAPTURE, orderId) shouldBe 1

                val fulfillmentIds = fulfillmentJdbc.queryForList("SELECT id FROM fulfillment_order WHERE order_id = ?", Long::class.java, orderId)
                fulfillmentIds shouldHaveSize 1
                fulfillmentJdbc.queryForList(
                    "SELECT product_id, quantity FROM fulfillment_line WHERE fulfillment_id = ?", fulfillmentIds.single(),
                ).map { (it["product_id"] as Number).toLong() to (it["quantity"] as Number).toInt() } shouldBe listOf(productId to 2)

                val confirmed = orderJdbc.queryForList(
                    "SELECT payload, partition_key FROM outbox_event WHERE aggregate_id = ? AND event_type = 'order.order.confirmed'", orderId,
                ).single()
                confirmed["partition_key"] shouldBe orderId.toString()
                val payload = objectMapper.readTree(confirmed["payload"] as String)
                payload.get("payableAmount").asLong() shouldBe 24_000L
                payload.get("lines").size() shouldBe 1
                payload.get("lines").get(0).get("quantity").asInt() shouldBe 2
                payload.get("shippingLines").get(0).get("fee").asLong() shouldBe 3_000L
            }
        }

        Given("10. 같은 Idempotency-Key 로 두 번 접수") {
            Then("주문은 하나 — 두 번째는 처음 응답을 그대로 돌려준다") {
                val productId = product("멱등 부채", 5_000L, 5)
                val sheet = createSheet.execute(
                    CreateOrderSheetUseCase.Command("e2e-idem", listOf(CreateOrderSheetUseCase.Item(productId, 1)), false, null, 0L),
                )
                val key = "idem-${UUID.randomUUID()}"
                val first = place.place(PlaceOrderUseCase.Command("e2e-idem", key, sheet.id))
                val second = place.place(PlaceOrderUseCase.Command("e2e-idem", key, sheet.id))

                second shouldBe first
                orderJdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE user_id = 'e2e-idem'", Long::class.java) shouldBe 1L
                eventually(10.seconds) { orderStatus(first.orderId) shouldBe "FULFILLING" }
                calls(MockPgCallRecorder.Op.AUTHORIZE, first.orderId) shouldBe 1
                stock(productId) shouldBe (4 to 0)
            }
        }

        Given("9. 0원 주문 — 쿠폰 2,000 + 포인트 1,000 이 상품 3,000 을 다 덮고 배송비 없음") {
            Then("결제 행 0 · PG 호출 0 · CONFIRMED → FULFILLING · 혜택 CONFIRMED") {
                val productId = product("0원 붓", 3_000L, 5)
                val coupon = claim("e2e-zero", couponDefinitionId)
                grant("e2e-zero", 1_000L)
                val orderId = placeOrder("e2e-zero", productId, 1, 0L, userCouponId = coupon, pointAmount = 1_000L)

                eventually(10.seconds) {
                    saga(orderId)["status"] shouldBe "COMPLETED"
                    orderStatus(orderId) shouldBe "FULFILLING"
                }
                history(orderId) shouldNotContain "PAYMENT_PENDING"
                history(orderId) shouldContainInOrder listOf("CREATED", "CONFIRMED", "FULFILLING")
                payments(orderId) shouldHaveSize 0
                calls(MockPgCallRecorder.Op.AUTHORIZE, orderId) shouldBe 0
                holdStatus(orderId) shouldBe "CONFIRMED"
                reservationStatuses(orderId) shouldBe listOf("CONFIRMED")
                points("e2e-zero") shouldBe 0L
            }
        }

        Given("2. 결제 거절") {
            Then("혜택 원복(포인트 반환) · 재고 해제 · 주문 FAILED(PAYMENT_DECLINED) · 매입 0회") {
                scenario.script(7_000L, ScriptedMockPgScenario.Script(authorize = Outcome.DECLINE))
                val productId = product("거절 먹", 7_100L, 5)
                grant("e2e-decline", 100L)
                val orderId = placeOrder("e2e-decline", productId, 1, 7_000L, pointAmount = 100L)

                eventually(10.seconds) {
                    order(orderId).let { it["status"] shouldBe "FAILED"; it["failure_reason"] shouldBe "PAYMENT_DECLINED" }
                    saga(orderId)["status"] shouldBe "FAILED"
                }
                paymentStatus(orderId) shouldBe "FAILED"
                holdStatus(orderId) shouldBe "CANCELLED"
                points("e2e-decline") shouldBe 100L
                reservationStatuses(orderId) shouldBe listOf("CANCELLED")
                stock(productId) shouldBe (5 to 0)
                calls(MockPgCallRecorder.Op.AUTHORIZE, orderId) shouldBe 1
                calls(MockPgCallRecorder.Op.CAPTURE, orderId) shouldBe 0
            }
        }

        Given("3. 재고 부족 — 재고 1개에 2개 주문") {
            Then("PG 승인 호출 0회 · 예약 0행 · FAILED(INSUFFICIENT_STOCK)") {
                val productId = product("부족 한지", 6_000L, 1)
                val orderId = placeOrder("e2e-stock", productId, 2, 12_000L)

                eventually(10.seconds) {
                    order(orderId).let { it["status"] shouldBe "FAILED"; it["failure_reason"] shouldBe "INSUFFICIENT_STOCK" }
                }
                calls(MockPgCallRecorder.Op.AUTHORIZE, orderId) shouldBe 0
                payments(orderId) shouldHaveSize 0
                reservationStatuses(orderId) shouldHaveSize 0
                stock(productId) shouldBe (1 to 0)
            }
        }

        Given("4. 결제 결과 미상(타임아웃) → 재조회 두 번째에 승인") {
            Then("미상인 동안 주문은 PAYMENT_PENDING 에 머물고(사가 기한이 와도 취소 없음) 승인 결론 뒤 CONFIRMED → FULFILLING") {
                scenario.script(
                    7_300L,
                    ScriptedMockPgScenario.Script(authorize = Outcome.TIMEOUT, inquire = { n -> if (n >= 2) Outcome.APPROVE else Outcome.TIMEOUT }),
                )
                val productId = product("미상 벼루", 7_300L, 5)
                val orderId = placeOrder("e2e-unknown", productId, 1, 7_300L)

                eventually(10.seconds) {
                    paymentStatus(orderId) shouldBe "UNKNOWN"
                    orderStatus(orderId) shouldBe "PAYMENT_PENDING"
                }
                val deadlineBefore = saga(orderId)["next_deadline_at"] as java.time.LocalDateTime
                // 사가 기한(2초)이 한 번 이상 지나가는 동안 — 결제 미상이면 WAIT 로 기한만 미룬다
                continually(3.seconds) {
                    orderStatus(orderId) shouldBe "PAYMENT_PENDING"
                    saga(orderId).let { it["status"] shouldBe "RUNNING"; it["step"] shouldBe "PAYMENT_AUTHORIZE" }
                    reservationStatuses(orderId) shouldBe listOf("ACTIVE")
                }
                (saga(orderId)["next_deadline_at"] as java.time.LocalDateTime) shouldBeGreaterThan deadlineBefore

                paymentClock.advance(Duration.ofSeconds(31)) // 첫 재조회 — 아직 결론 없음
                eventually(10.seconds) { calls(MockPgCallRecorder.Op.INQUIRE, orderId) shouldBe 1 }
                orderStatus(orderId) shouldBe "PAYMENT_PENDING"
                paymentClock.advance(Duration.ofSeconds(61)) // 두 번째 재조회 — 승인

                eventually(10.seconds) {
                    orderStatus(orderId) shouldBe "FULFILLING"
                    saga(orderId)["status"] shouldBe "COMPLETED"
                }
                history(orderId) shouldContainInOrder listOf("PAYMENT_PENDING", "PAID", "CONFIRMED", "FULFILLING")
                history(orderId) shouldNotContain "FAILED"
                paymentStatus(orderId) shouldBe "CAPTURED"
                calls(MockPgCallRecorder.Op.AUTHORIZE, orderId) shouldBe 1
            }
        }

        Given("5. 결제 결과 미상 → 재조회 결론 거절") {
            Then("보상 실행 — 재고 해제 · 혜택 원복 · FAILED(PAYMENT_DECLINED)") {
                scenario.script(7_400L, ScriptedMockPgScenario.Script(authorize = Outcome.TIMEOUT, inquire = { Outcome.DECLINE }))
                val productId = product("미상 거절 묵", 7_500L, 5)
                grant("e2e-unknown-fail", 100L)
                val orderId = placeOrder("e2e-unknown-fail", productId, 1, 7_400L, pointAmount = 100L)

                eventually(10.seconds) { paymentStatus(orderId) shouldBe "UNKNOWN" }
                points("e2e-unknown-fail") shouldBe 0L
                paymentClock.advance(Duration.ofSeconds(31))

                eventually(10.seconds) {
                    order(orderId).let { it["status"] shouldBe "FAILED"; it["failure_reason"] shouldBe "PAYMENT_DECLINED" }
                    saga(orderId)["status"] shouldBe "FAILED"
                }
                paymentStatus(orderId) shouldBe "FAILED"
                holdStatus(orderId) shouldBe "CANCELLED"
                points("e2e-unknown-fail") shouldBe 100L
                reservationStatuses(orderId) shouldBe listOf("CANCELLED")
                stock(productId) shouldBe (5 to 0)
                calls(MockPgCallRecorder.Op.VOID, orderId) shouldBe 0
            }
        }

        Given("6. 보류 만료 (a) — 승인 뒤 · 매입 전에 재고 예약 기한이 지남") {
            Then("VOID 실행 → 결제 VOIDED · PAID → FAILED(HOLD_EXPIRED) · 재고는 원래대로(다시 팔 수 있다) · 매입 0회") {
                // 승인 답을 정하기 직전에 예약 기한을 과거로 — 사가는 승인을 받고 재고 확정을 보내지만 예약은 이미 지났다
                scenario.script(
                    7_500L,
                    ScriptedMockPgScenario.Script(beforeAuthorize = { no -> lapseReservation(no.removePrefix("ORD-").substringBefore('-').toLong()) }),
                )
                val productId = product("만료 a 종이", 7_600L, 5)
                grant("e2e-hold-a", 100L)
                val orderId = placeOrder("e2e-hold-a", productId, 1, 7_500L, pointAmount = 100L)

                eventually(10.seconds) {
                    order(orderId).let { it["status"] shouldBe "FAILED"; it["failure_reason"] shouldBe "HOLD_EXPIRED" }
                    saga(orderId)["status"] shouldBe "FAILED"
                }
                history(orderId) shouldContainInOrder listOf("PAYMENT_PENDING", "PAID", "FAILED")
                paymentStatus(orderId) shouldBe "VOIDED"
                calls(MockPgCallRecorder.Op.VOID, orderId) shouldBe 1
                calls(MockPgCallRecorder.Op.CAPTURE, orderId) shouldBe 0
                reservationStatuses(orderId) shouldBe listOf("EXPIRED")
                stock(productId) shouldBe (5 to 0)
                holdStatus(orderId) shouldBe "CANCELLED"
                points("e2e-hold-a") shouldBe 100L
            }
        }

        Given("7. 보류 만료 (b) — 결제 결과 미상 중에 재고·혜택 보류가 만료") {
            Then("만료 직후 VOID 호출 0회(예약만) → 재조회 결론 승인 → 그때 VOID 실행 → FAILED(HOLD_EXPIRED), 승인된 채 남지 않음") {
                scenario.script(7_600L, ScriptedMockPgScenario.Script(authorize = Outcome.TIMEOUT, inquire = { Outcome.APPROVE }))
                val productId = product("만료 b 승인 인주", 7_700L, 5)
                grant("e2e-hold-b1", 100L)
                val orderId = placeOrder("e2e-hold-b1", productId, 1, 7_600L, pointAmount = 100L)
                eventually(10.seconds) {
                    paymentStatus(orderId) shouldBe "UNKNOWN"
                    holdStatus(orderId) shouldBe "RESERVED"
                }

                lapseReservation(orderId)
                lapsePromotionHold(orderId)
                ctx.getBean(ExpireReservationsUseCase::class.java).execute() shouldBe 1
                ctx.getBean(ExpirePromotionHoldsUseCase::class.java).expireDue() shouldBe 1

                eventually(10.seconds) {
                    saga(orderId).let { it["status"] shouldBe "COMPENSATING"; it["step"] shouldBe "PAYMENT_VOID" }
                    payments(orderId).single()["void_requested_at"].shouldNotBeNull()
                }
                continually(3.seconds) {
                    calls(MockPgCallRecorder.Op.VOID, orderId) shouldBe 0
                    paymentStatus(orderId) shouldBe "UNKNOWN"
                    orderStatus(orderId) shouldBe "PAYMENT_PENDING"
                }

                paymentClock.advance(Duration.ofSeconds(31))
                eventually(10.seconds) {
                    order(orderId).let { it["status"] shouldBe "FAILED"; it["failure_reason"] shouldBe "HOLD_EXPIRED" }
                    saga(orderId)["status"] shouldBe "FAILED"
                }
                paymentStatus(orderId) shouldBe "VOIDED"
                calls(MockPgCallRecorder.Op.VOID, orderId) shouldBe 1
                calls(MockPgCallRecorder.Op.CAPTURE, orderId) shouldBe 0
                reservationStatuses(orderId) shouldBe listOf("EXPIRED")
                stock(productId) shouldBe (5 to 0)
                holdStatus(orderId) shouldBe "EXPIRED"
                points("e2e-hold-b1") shouldBe 100L
            }

            Then("변형 — 재조회 결론이 거절이면 VOID 는 끝까지 0회, FAILED(HOLD_EXPIRED)") {
                scenario.script(7_700L, ScriptedMockPgScenario.Script(authorize = Outcome.TIMEOUT, inquire = { Outcome.DECLINE }))
                val productId = product("만료 b 거절 인주", 7_800L, 5)
                grant("e2e-hold-b2", 100L)
                val orderId = placeOrder("e2e-hold-b2", productId, 1, 7_700L, pointAmount = 100L)
                eventually(10.seconds) {
                    paymentStatus(orderId) shouldBe "UNKNOWN"
                    holdStatus(orderId) shouldBe "RESERVED"
                }

                lapseReservation(orderId)
                lapsePromotionHold(orderId)
                ctx.getBean(ExpireReservationsUseCase::class.java).execute() shouldBe 1
                ctx.getBean(ExpirePromotionHoldsUseCase::class.java).expireDue() shouldBe 1
                eventually(10.seconds) { saga(orderId)["step"] shouldBe "PAYMENT_VOID" }

                paymentClock.advance(Duration.ofSeconds(31))
                eventually(10.seconds) {
                    order(orderId).let { it["status"] shouldBe "FAILED"; it["failure_reason"] shouldBe "HOLD_EXPIRED" }
                    saga(orderId)["status"] shouldBe "FAILED"
                }
                paymentStatus(orderId) shouldBe "FAILED"
                calls(MockPgCallRecorder.Op.VOID, orderId) shouldBe 0
                stock(productId) shouldBe (5 to 0)
                points("e2e-hold-b2") shouldBe 100L
            }
        }

        Given("8. 피벗 뒤 실패 — 매입 호출이 응답 없음") {
            Then("처음 명령이 컨슈머 재시도까지 다 실패해도 사가 기한 재발행이 매입을 다시 내 수렴한다") {
                scenario.script(7_900L, ScriptedMockPgScenario.Script(captureFailures = 4))
                val productId = product("재시도 붓걸이", 7_900L, 5)
                val orderId = placeOrder("e2e-retry", productId, 1, 7_900L)

                eventually(15.seconds) {
                    saga(orderId)["status"] shouldBe "COMPLETED"
                    orderStatus(orderId) shouldBe "FULFILLING"
                }
                paymentStatus(orderId) shouldBe "CAPTURED"
                calls(MockPgCallRecorder.Op.CAPTURE, orderId) shouldBeGreaterThanOrEqual 5
                // 사가가 매입 명령을 한 번 이상 다시 냈다(컨슈머 재시도만으로는 4번째 실패에서 DLT 로 끝난다)
                outboxCount(orderId, "payment.command.capture")!! shouldBeGreaterThan 1L
                orderJdbc.queryForObject("SELECT COUNT(*) FROM ops_issue WHERE target_id = ?", Long::class.java, orderId.toString()) shouldBe 0L
            }

            Then("매입이 계속 실패하면 재시도 한도(4회) 뒤 STUCK + 운영 이슈 한 행 — 주문은 PAID 에 머문다") {
                scenario.script(8_100L, ScriptedMockPgScenario.Script(captureFailures = Int.MAX_VALUE))
                val productId = product("멈춤 서진", 8_100L, 5)
                val orderId = placeOrder("e2e-stuck", productId, 1, 8_100L)

                // 기한 2초 × (재시도 4 + 1) ≈ 10초 뒤 — 피벗 뒤 경로의 정의상 10초 판정창보다 길다
                eventually(20.seconds) { saga(orderId)["status"] shouldBe "STUCK" }
                saga(orderId)["step"] shouldBe "PAYMENT_CAPTURE"
                orderStatus(orderId) shouldBe "PAID"
                paymentStatus(orderId) shouldBe "AUTHORIZED"
                orderJdbc.queryForList(
                    "SELECT type, status, detail FROM ops_issue WHERE target_id = ?", orderId.toString(),
                ).let { rows ->
                    rows shouldHaveSize 1
                    rows.single()["type"] shouldBe "SAGA_STUCK"
                    (rows.single()["detail"] as String) shouldStartWith "사가 단계 PAYMENT_CAPTURE"
                }
                reservationStatuses(orderId) shouldBe listOf("CONFIRMED")
            }
        }
    }

    class DockerOrCi : EnabledCondition {
        override fun enabled(kclass: KClass<out Spec>): Boolean = dockerAvailable || isCi
    }

    companion object {
        private val isCi = System.getenv("CI") == "true"
        private val dockerAvailable: Boolean =
            runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

        private val mysql: MySQLContainer<*> by lazy {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("inventory_db")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use { st ->
                            listOf("warehouse_db", "fulfillment_db", "order_db", "product_db", "deal_db", "seller_db", "payment_db", "promotion_db", "settlement_db")
                                .forEach { st.execute("CREATE DATABASE IF NOT EXISTS $it") }
                        }
                    }
                }
        }

        private val kafka: KafkaContainer by lazy {
            // 3.9 이미지는 이 Testcontainers 버전의 advertised.listeners(0.0.0.0) 와 맞지 않아 기동하지 않는다.
            KafkaContainer(DockerImageName.parse("apache/kafka:3.8.1")).also { it.start() }
        }

        /**
         * 사가·읽기 모델 토픽을 컨텍스트보다 먼저 만든다 — 없는 토픽을 구독한 컨슈머는 메타데이터 갱신(기본 5분)까지
         * 할당을 못 받을 수 있다. 준비 단계에서 레지스트리의 토픽을 한 번 더 확인한다.
         */
        private val SAGA_TOPICS = listOf(
            "inventory.command.reserve", "inventory.command.confirm", "inventory.command.release", "inventory.command.restock",
            "inventory.reservation.reserved", "inventory.reservation.failed", "inventory.reservation.confirmed",
            "inventory.reservation.released", "inventory.reservation.restocked", "inventory.reservation.expired",
            "inventory.stock.reserved", "inventory.stock.released", "inventory.stock.confirmed", "inventory.stock.received",
            "inventory.stock.restocked",
            "promotion.command.reserve", "promotion.command.confirm", "promotion.command.cancel", "promotion.command.restore",
            "promotion.hold.reserved", "promotion.hold.failed", "promotion.hold.confirmed", "promotion.hold.cancelled",
            "promotion.hold.expired", "promotion.hold.restored", "promotion.coupon.defined", "promotion.coupon.issued",
            "promotion.point.changed",
            "payment.command.authorize", "payment.command.capture", "payment.command.void", "payment.command.refund",
            "payment.payment.authorized", "payment.payment.failed", "payment.payment.unknown", "payment.payment.captured",
            "payment.payment.voided",
            "fulfillment.command.create", "fulfillment.command.cancel", "fulfillment.order.created", "fulfillment.order.cancelled",
            "fulfillment.order.shipped", "fulfillment.order.delivered", "fulfillment.order.cancel-rejected",
            "product.item.created", "product.item.updated",
            "seller.seller.applied", "seller.seller.approved", "seller.seller.suspended", "seller.seller.reactivated",
            "seller.seller.updated", "order.order.confirmed",
        )

        fun createTopics(topics: Collection<String>) {
            AdminClient.create(mapOf(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG to kafka.bootstrapServers)).use { admin ->
                val missing = topics.toSet() - admin.listTopics().names().get()
                if (missing.isNotEmpty()) {
                    admin.createTopics(missing.map { NewTopic(it, 1, 1.toShort()) }).all().get(30, TimeUnit.SECONDS)
                }
            }
        }

        /** 준비 단계용 — 판정이 아니라 선행 조건을 기다린다(판정은 Kotest eventually) */
        fun awaitUntil(what: String, timeoutSeconds: Long = 10, condition: () -> Boolean) {
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds)
            while (System.nanoTime() < deadline) {
                if (runCatching(condition).getOrDefault(false)) return
                Thread.sleep(100)
            }
            error("${timeoutSeconds}초 안에 준비되지 않았다: $what")
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val inv = mysql.jdbcUrl
            registry.add("spring.kafka.bootstrap-servers") { kafka.bootstrapServers.also { createTopics(SAGA_TOPICS) } }
            fun ds(prefix: String, url: String) {
                registry.add("$prefix.jdbc-url") { url }
                registry.add("$prefix.username") { mysql.username }
                registry.add("$prefix.password") { mysql.password }
                registry.add("$prefix.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            for (role in listOf("master", "replica")) {
                ds("spring.datasource.$role", inv)
                for (domain in listOf("warehouse", "fulfillment", "order", "product", "seller", "payment", "promotion", "settlement")) {
                    ds("spring.datasource.$domain.$role", inv.replace("/inventory_db", "/${domain}_db"))
                }
            }
            registry.add("spring.datasource.deal.url") { inv.replace("/inventory_db", "/deal_db") }
            registry.add("spring.datasource.deal.username") { mysql.username }
            registry.add("spring.datasource.deal.password") { mysql.password }
            registry.add("spring.datasource.deal.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
