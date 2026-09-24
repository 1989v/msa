package com.kgd.commerce.saga

import com.kgd.commerce.CommerceApplication
import com.kgd.fulfillment.application.fulfillment.usecase.TransitionFulfillmentUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.order.application.claim.usecase.DecideClaimUseCase
import com.kgd.order.application.claim.usecase.RequestClaimUseCase
import com.kgd.order.application.order.usecase.ConfirmPurchaseUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.application.sheet.usecase.CreateOrderSheetUseCase
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase
import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.application.point.usecase.GrantPointsUseCase
import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponType
import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.application.seller.usecase.ManageSellerUseCase
import com.kgd.seller.domain.seller.model.SettlementCycle
import io.kotest.assertions.nondeterministic.eventually
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.longs.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
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
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.sql.DataSource
import kotlin.reflect.KClass
import kotlin.time.Duration.Companion.seconds

/**
 * 클레임 E2E (스펙 SR-8). commerce 호스트 전체 + 실제 MySQL(모든 도메인 Flyway + validate) + 실제 Kafka — 사가 E2E 와 같은 구성.
 * 이행 취소 → 재입고 → 혜택 원복 → PG 부분 환불이 실제 명령 컨슈머와 아웃박스 릴레이를 거친다.
 *
 * 판정은 각 도메인 DB 행이다: 결제 상태·환불 누계(payment_db), 라인 상태·환불 누계(order_db), 재고(inventory_db),
 * 포인트 잔액·쿠폰 상태(promotion_db), 정산 이벤트 아웃박스 행의 페이로드(order_db).
 */
@EnabledIf(ClaimE2ETest.DockerOrCi::class)
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
        "order.saga.step-timeout-seconds=5",
        "order.saga.deadline-check-interval-ms=300",
        "order.saga.deadline-initial-delay-ms=0",
        "order.claim.deadline-check-interval-ms=300",
        "order.claim.deadline-initial-delay-ms=0",
        // 자동 구매 확정은 이 테스트에서 돌지 않는다 — 확정은 버튼(유스케이스)으로 부른다
        "order.purchase-confirm.initial-delay-ms=3600000",
    ],
)
class ClaimE2ETest(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    private val orderJdbc = JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))
    private val inventoryJdbc = JdbcTemplate(ctx.getBean("masterDataSource", DataSource::class.java))
    private val paymentJdbc = JdbcTemplate(ctx.getBean("paymentMasterDataSource", DataSource::class.java))
    private val promotionJdbc = JdbcTemplate(ctx.getBean("promotionMasterDataSource", DataSource::class.java))
    private val fulfillmentJdbc = JdbcTemplate(ctx.getBean("fulfillmentMasterDataSource", DataSource::class.java))
    private val objectMapper = ctx.getBean(ObjectMapper::class.java)

    private val createSheet = ctx.getBean(CreateOrderSheetUseCase::class.java)
    private val place = ctx.getBean(PlaceOrderUseCase::class.java)
    private val requestClaim = ctx.getBean(RequestClaimUseCase::class.java)
    private val decideClaim = ctx.getBean(DecideClaimUseCase::class.java)
    private val confirmPurchase = ctx.getBean(ConfirmPurchaseUseCase::class.java)
    private val transition = ctx.getBean(TransitionFulfillmentUseCase::class.java)

    private val sellerMember = "claim-e2e-seller"
    private val sellerRequester = ProductRequester(sellerMember, setOf("ROLE_USER", "ROLE_SELLER"))

    // ---- 조회 ----

    private fun orderRow(id: Long) = orderJdbc.queryForMap("SELECT status, refunded_amount FROM orders WHERE id = ?", id)
    private fun line(orderId: Long, productId: Long) = orderJdbc.queryForMap(
        "SELECT line_no, status, quantity, unit_price_won, coupon_discount, point_amount FROM order_items WHERE order_id = ? AND product_id = ?",
        orderId, productId,
    )
    private fun claim(orderId: Long) =
        orderJdbc.queryForMap("SELECT id, status, step, refund_amount, point_restore, shipping_refund FROM order_claim WHERE order_id = ?", orderId)
    private fun payment(orderId: Long) = paymentJdbc.queryForMap("SELECT status, amount, refunded_amount FROM payment WHERE order_id = ?", orderId)
    private fun available(productId: Long) =
        requireNotNull(inventoryJdbc.queryForObject("SELECT available_qty FROM inventory WHERE product_id = ?", Int::class.java, productId))
    private fun points(memberId: String) =
        requireNotNull(promotionJdbc.queryForObject("SELECT balance FROM point_balance WHERE member_id = ?", Long::class.java, memberId))
    private fun couponStatus(userCouponId: Long) =
        promotionJdbc.queryForObject("SELECT status FROM user_coupon WHERE id = ?", String::class.java, userCouponId)
    private fun outboxPayloads(orderId: Long, topic: String) = orderJdbc.queryForList(
        "SELECT payload FROM outbox_event WHERE partition_key = ? AND event_type = ? ORDER BY id", String::class.java, orderId.toString(), topic,
    ).map { objectMapper.readTree(it) }

    // ---- 준비 (유스케이스로) ----

    private fun product(name: String, price: Long, stock: Int): Long {
        val id = ctx.getBean(CreateProductUseCase::class.java)
            .execute(CreateProductUseCase.Command(name = name, price = price.toBigDecimal(), stock = stock), sellerRequester).id
        ctx.getBean(ReceiveStockUseCase::class.java).execute(ReceiveStockUseCase.Command(productId = id, warehouseId = 1L, qty = stock))
        awaitUntil("product_view $id") {
            orderJdbc.queryForList("SELECT price FROM product_view WHERE product_id = ?", Long::class.java, id).singleOrNull() == price
        }
        return id
    }

    private fun grant(memberId: String, amount: Long) {
        ctx.getBean(GrantPointsUseCase::class.java).grant(GrantPointsUseCase.Grant(memberId, amount, "1", "클레임 E2E"))
        awaitUntil("point_balance_view $memberId") {
            orderJdbc.queryForList("SELECT balance FROM point_balance_view WHERE member_id = ?", Long::class.java, memberId)
                .singleOrNull() == points(memberId)
        }
    }

    private fun issueCoupon(memberId: String, definitionId: Long): Long {
        val userCouponId = ctx.getBean(ClaimCouponUseCase::class.java).claim(memberId, definitionId).userCouponId
        awaitUntil("user_coupon_view $userCouponId") {
            orderJdbc.queryForList("SELECT status FROM user_coupon_view WHERE user_coupon_id = ?", String::class.java, userCouponId)
                .singleOrNull() == "AVAILABLE"
        }
        return userCouponId
    }

    /** 두 상품 주문 → 사가 COMPLETED · 주문 FULFILLING 까지 */
    private fun placeTwoLines(buyer: String, a: Long, b: Long, userCouponId: Long?, pointAmount: Long): Long {
        val sheet = createSheet.execute(
            CreateOrderSheetUseCase.Command(
                buyer, listOf(CreateOrderSheetUseCase.Item(a, 2), CreateOrderSheetUseCase.Item(b, 1)), false, userCouponId, pointAmount,
            ),
        )
        val orderId = place.place(PlaceOrderUseCase.Command(buyer, UUID.randomUUID().toString(), sheet.id)).orderId
        awaitUntil("주문 $orderId FULFILLING", timeoutSeconds = 20) { orderRow(orderId)["status"] == "FULFILLING" }
        return orderId
    }

    init {
        var productA = 0L
        var productB = 0L
        var couponDefinitionId = 0L

        Given("준비 — 리스너 할당 · 판매자 승인(배송비 3,000) · 판매자 상품 둘 · 쿠폰 정의") {
            Then("모든 리스너 컨테이너가 파티션을 받고, 판매자 행이 order 읽기 모델에 회원 id 와 함께 들어온다") {
                val registry = ctx.getBean(KafkaListenerEndpointRegistry::class.java)
                createTopics(registry.listenerContainers.flatMap { it.containerProperties.topics.orEmpty().toList() }.toSet())
                awaitUntil("리스너 할당", timeoutSeconds = 90) {
                    registry.listenerContainers.filter { it.isRunning }.all { !it.assignedPartitions.isNullOrEmpty() }
                }
                val seller = ctx.getBean(ApplySellerUseCase::class.java).execute(
                    ApplySellerUseCase.Command(
                        memberId = sellerMember, businessName = "클레임 상점", businessRegistrationNo = "444-55-66666",
                        representativeName = "대표", bankName = "은행", accountNumber = "110-444-555666",
                        shippingFee = 3_000L, settlementCycle = SettlementCycle.WEEKLY,
                    ),
                )
                ctx.getBean(ManageSellerUseCase::class.java).approve(ManageSellerUseCase.Approve(seller.id, "1", 1_000, "클레임 E2E"))
                awaitUntil("seller_view ${seller.id}") {
                    orderJdbc.queryForList("SELECT member_id FROM seller_view WHERE seller_id = ? AND status = 'ACTIVE'", String::class.java, seller.id)
                        .singleOrNull() == sellerMember
                }
                awaitUntil("product_seller ${seller.id}") {
                    ctx.getBean("productMasterDataSource", DataSource::class.java).let(::JdbcTemplate)
                        .queryForList("SELECT status FROM product_seller WHERE seller_id = ?", String::class.java, seller.id).singleOrNull() == "ACTIVE"
                }
                productA = product("클레임 머그", 12_000L, 10)
                productB = product("클레임 받침", 8_000L, 10)
                couponDefinitionId = ctx.getBean(ManageCouponDefinitionUseCase::class.java).create(
                    ManageCouponDefinitionUseCase.Create(
                        name = "클레임 2천원", type = CouponType.FIXED, amount = 2_000L, rateBp = null, maxDiscount = null,
                        minOrderAmount = 0L, validFrom = Instant.now().minusSeconds(3_600), validUntil = Instant.now().plusSeconds(86_400),
                        issueLimit = 100, bearer = CouponBearer.PLATFORM, sellerId = null, actorId = "1",
                    ),
                ).id
            }
        }

        Given("1. 출고 전 부분 취소 — 머그 2개(쿠폰·포인트 안분) 취소, 받침 1개는 남긴다") {
            Then("결제 PARTIALLY_REFUNDED · 라인 CANCELLED · 환불 누계 = 라인 결제액 · 재입고 · 포인트 원복 · 쿠폰 유지 · 배송비 유지 → 남은 라인 확정 COMPLETED") {
                val buyer = "claim-e2e-partial"
                val coupon = issueCoupon(buyer, couponDefinitionId)
                grant(buyer, 1_000L)
                val orderId = placeTwoLines(buyer, productA, productB, coupon, 1_000L)
                val pointsBefore = points(buyer)
                val stockBefore = available(productA)
                val mug = line(orderId, productA)
                val lineNo = (mug["line_no"] as Number).toInt()
                // 라인 결제액 = 판매가 × 수량 − 쿠폰 안분 − 포인트 안분 (주문 라인 스냅샷에서 독립 계산)
                val mugPoints = (mug["point_amount"] as Number).toLong()
                val mugPayable = (mug["unit_price_won"] as Number).toLong() * 2 - (mug["coupon_discount"] as Number).toLong() - mugPoints
                mugPoints shouldBeGreaterThan 0L

                requestClaim.request(buyer, orderId, listOf(lineNo))

                eventually(20.seconds) { claim(orderId)["status"] shouldBe "REFUNDED" }
                payment(orderId).let {
                    it["status"] shouldBe "PARTIALLY_REFUNDED"
                    (it["refunded_amount"] as Number).toLong() shouldBe mugPayable
                }
                line(orderId, productA)["status"] shouldBe "CANCELLED"
                line(orderId, productB)["status"] shouldBe "ACTIVE"
                orderRow(orderId).let {
                    it["status"] shouldBe "FULFILLING"
                    (it["refunded_amount"] as Number).toLong() shouldBe mugPayable
                }
                claim(orderId).let {
                    (it["refund_amount"] as Number).toLong() shouldBe mugPayable
                    (it["point_restore"] as Number).toLong() shouldBe mugPoints
                    (it["shipping_refund"] as Number).toLong() shouldBe 0L
                }
                available(productA) shouldBe stockBefore + 2
                points(buyer) shouldBe pointsBefore + mugPoints
                couponStatus(coupon) shouldBe "USED"
                fulfillmentJdbc.queryForObject(
                    "SELECT l.status FROM fulfillment_line l JOIN fulfillment_order o ON o.id = l.fulfillment_id WHERE o.order_id = ? AND l.product_id = ?",
                    String::class.java, orderId, productA,
                ) shouldBe "CANCELLED"

                // 정산 이벤트 — 환불 라인 n·c·dp·p 와 PG 환불액
                val refunded = outboxPayloads(orderId, "order.claim.refunded").single()
                refunded["refundAmount"].asLong() shouldBe mugPayable
                refunded["pointRestored"].asLong() shouldBe mugPoints
                refunded["lines"].single().let { l ->
                    (l["netSales"].asLong() - l["platformCouponAllocation"].asLong() - l["pointAllocation"].asLong()) shouldBe mugPayable
                }

                // 남은 라인 구매 확정 → COMPLETED, 판매자 마지막 ACTIVE 라인이라 배송비 라인 3,000 이 실린다
                confirmPurchase.confirm(buyer, orderId)
                orderRow(orderId)["status"] shouldBe "COMPLETED"
                val confirmed = outboxPayloads(orderId, "order.line.purchase-confirmed").single()
                confirmed["line"]["productId"].asLong() shouldBe productB
                confirmed["shippingLine"]["fee"].asLong() shouldBe 3_000L
            }
        }

        Given("2. 출고 뒤 취소 — 이행이 cancel-rejected 로 답하면 판매자 결정을 기다린다") {
            Then("판매자 승인 → 재입고 없이 환불, 판매자 라인이 전부 취소돼도 출고라 배송비는 돌려주지 않는다") {
                val buyer = "claim-e2e-shipped"
                val orderId = placeTwoLines(buyer, productA, productB, userCouponId = null, pointAmount = 0L)
                val fulfillmentId = requireNotNull(fulfillmentJdbc.queryForObject("SELECT id FROM fulfillment_order WHERE order_id = ?", Long::class.java, orderId))
                listOf("PICKING", "PACKING", "SHIPPED").forEach { transition.execute(TransitionFulfillmentUseCase.Command(fulfillmentId, it)) }
                eventually(10.seconds) {
                    orderJdbc.queryForList("SELECT shipped_at FROM order_items WHERE order_id = ?", orderId).all { it["shipped_at"] != null } shouldBe true
                }
                val stockBefore = available(productA) to available(productB)

                val claimId = requestClaim.request(buyer, orderId, null).single().claimId
                eventually(10.seconds) { claim(orderId)["step"] shouldBe "SELLER_DECISION" }
                claim(orderId)["status"] shouldBe "REQUESTED"

                decideClaim.approve(sellerMember, claimId)
                eventually(20.seconds) { claim(orderId)["status"] shouldBe "REFUNDED" }
                val itemsOnly = 12_000L * 2 + 8_000L
                payment(orderId).let {
                    it["status"] shouldBe "PARTIALLY_REFUNDED"
                    (it["refunded_amount"] as Number).toLong() shouldBe itemsOnly
                    (it["amount"] as Number).toLong() shouldBe itemsOnly + 3_000L
                }
                orderRow(orderId)["status"] shouldBe "CANCELLED"
                (available(productA) to available(productB)) shouldBe stockBefore
                orderJdbc.queryForList("SELECT status FROM order_items WHERE order_id = ?", String::class.java, orderId)
                    .shouldContainExactlyInAnyOrder("CANCELLED", "CANCELLED")
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
            KafkaContainer(DockerImageName.parse("apache/kafka:3.8.1")).also { it.start() }
        }

        /** 없는 토픽을 구독한 컨슈머는 메타데이터 갱신까지 할당을 못 받는다 — 클레임이 쓰는 토픽을 컨텍스트보다 먼저 만든다 */
        private val CLAIM_TOPICS = listOf(
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
            "payment.payment.voided", "payment.payment.refunded",
            "fulfillment.command.create", "fulfillment.command.cancel", "fulfillment.order.created", "fulfillment.order.cancelled",
            "fulfillment.order.shipped", "fulfillment.order.delivered", "fulfillment.order.cancel-rejected",
            "product.item.created", "product.item.updated",
            "seller.seller.applied", "seller.seller.approved", "seller.seller.suspended", "seller.seller.reactivated",
            "seller.seller.updated", "order.order.confirmed", "order.claim.refunded", "order.line.purchase-confirmed",
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
            registry.add("spring.kafka.bootstrap-servers") { kafka.bootstrapServers.also { createTopics(CLAIM_TOPICS) } }
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
