package com.kgd.commerce.order

import com.kgd.commerce.CommerceApplication
import com.kgd.common.messaging.outbox.OutboxEntity
import com.kgd.order.application.sheet.usecase.CreateOrderSheetUseCase
import com.kgd.order.application.sheet.usecase.GetOrderSheetUseCase
import com.kgd.order.domain.sheet.exception.OrderSheetNotFoundException
import com.kgd.order.domain.sheet.exception.OrderSheetUnavailableException
import com.kgd.order.domain.sheet.model.OrderSheetRejection
import com.kgd.order.infrastructure.messaging.OrderReadModelConsumer
import com.kgd.order.presentation.sheet.dto.CreateOrderSheetRequest
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.application.product.usecase.RepublishProductsUseCase
import com.kgd.product.infrastructure.messaging.SellerReadModelConsumer
import com.kgd.product.infrastructure.outbox.ProductOutboxRepository
import com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase
import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.application.point.usecase.GrantPointsUseCase
import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponType
import com.kgd.promotion.infrastructure.outbox.PromotionOutboxRepository
import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.application.seller.usecase.ManageSellerUseCase
import com.kgd.seller.domain.seller.model.SettlementCycle
import com.kgd.seller.infrastructure.outbox.SellerOutboxRepository
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.FlywayException
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import java.time.Instant
import javax.sql.DataSource
import kotlin.reflect.KClass

/**
 * 주문서 · 읽기 모델 · 금액 백필을 실제 MySQL 로 — **모든 도메인 Flyway + `ddl-auto=validate`** 로 띄워
 * 새 order 마이그레이션과 엔티티가 맞는지까지 본다(운영과 같은 조합).
 *
 * 읽기 모델은 손으로 만든 JSON 이 아니라 **발행 도메인의 유스케이스가 남긴 아웃박스 행**을 릴레이와 같은 모양
 * (페이로드 + eventId)으로 order 컨슈머에 넣어 채운다 — 계약이 어긋나면 여기서 깨진다.
 * 판정 근거는 order_db 행 값이다.
 */
@EnabledIf(OrderSheetIntegrationSpec.DockerOrCi::class)
@SpringBootTest(
    classes = [CommerceApplication::class],
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=false",
        "outbox.polling.enabled=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "spring.kafka.bootstrap-servers=localhost:9092",
        "promotion.hold-expiry.initial-delay-ms=3600000",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    ],
)
class OrderSheetIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    init {
        val objectMapper = ctx.getBean(ObjectMapper::class.java)
        val orderConsumer = ctx.getBean(OrderReadModelConsumer::class.java)
        val productSellerConsumer = ctx.getBean(SellerReadModelConsumer::class.java)
        val createSheet = ctx.getBean(CreateOrderSheetUseCase::class.java)
        val getSheet = ctx.getBean(GetOrderSheetUseCase::class.java)
        val orderJdbc = JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))

        val productOutbox = ctx.getBean(ProductOutboxRepository::class.java)
        val sellerOutbox = ctx.getBean(SellerOutboxRepository::class.java)
        val promotionOutbox = ctx.getBean(PromotionOutboxRepository::class.java)
        val delivered = mutableSetOf<String>()

        /** 릴레이가 보내는 레코드와 같은 모양 — 페이로드에 eventId 를 넣고 키는 partitionKey */
        fun record(row: OutboxEntity, timestamp: Long = System.currentTimeMillis()): ConsumerRecord<String, String> {
            val payload = (objectMapper.readTree(row.payload) as ObjectNode).put("eventId", row.eventId)
            return ConsumerRecord(
                row.eventType, 0, 0L, timestamp, org.apache.kafka.common.record.TimestampType.CREATE_TIME, 0, 0,
                row.partitionKey ?: row.aggregateId.toString(), objectMapper.writeValueAsString(payload),
                org.apache.kafka.common.header.internals.RecordHeaders(), java.util.Optional.empty(),
            )
        }

        /** 아직 전달하지 않은 아웃박스 행을 토픽별 order 컨슈머에 넣는다 */
        fun relayToOrder() {
            val rows = productOutbox.findAll() + sellerOutbox.findAll() + promotionOutbox.findAll()
            rows.sortedBy { it.id }.filter { delivered.add("${it.aggregateType}:${it.eventId}") }.forEach { row ->
                val r = record(row)
                when {
                    row.eventType.startsWith("product.item.") -> orderConsumer.onProduct(r)
                    row.eventType.startsWith("seller.seller.") -> {
                        orderConsumer.onSeller(r)
                        productSellerConsumer.onSellerEvent(r) // 판매자 상품 등록 권한(product 읽기 모델)
                    }
                    row.eventType == "promotion.coupon.defined" -> orderConsumer.onCouponDefined(r)
                    row.eventType == "promotion.coupon.issued" -> orderConsumer.onCouponIssued(r)
                    row.eventType == "promotion.point.changed" -> orderConsumer.onPointChanged(r)
                    row.eventType.startsWith("promotion.hold.") -> orderConsumer.onHold(r)
                }
            }
        }

        fun sheetRequest(json: String): CreateOrderSheetRequest = objectMapper.readValue(json, CreateOrderSheetRequest::class.java)

        Given("금액 백필 마이그레이션 (DECIMAL → BIGINT, 확장)") {
            fun flyway(db: String, target: String? = null) = Flyway.configure()
                .dataSource(jdbcUrl(db), mysql.username, mysql.password)
                .locations("classpath:orderdb/migration")
                .apply { target?.let { target(it) } }
                .load()

            Then("정수 단가는 unit_price_won 으로 옮겨지고 옛 컬럼은 그대로") {
                flyway("order_backfill_ok", target = "20260924.001").migrate()
                val jdbc = jdbcOf("order_backfill_ok")
                jdbc.update("INSERT INTO orders (id, user_id, status, created_at) VALUES (1, 'u', 'COMPLETED', NOW())")
                jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (1, 10, 2, 12000.00), (1, 11, 1, 3500.00)")

                flyway("order_backfill_ok").migrate()

                jdbc.queryForList("SELECT unit_price, unit_price_won FROM order_items ORDER BY product_id").map {
                    (it["unit_price"] as java.math.BigDecimal).toPlainString() to it["unit_price_won"]
                } shouldBe listOf("12000.00" to 12_000L, "3500.00" to 3_500L)
            }
            Then("소수 원이 한 행이라도 있으면 컬럼을 만들기 전에 멈춘다 — 스키마는 그대로") {
                flyway("order_backfill_fraction", target = "20260924.001").migrate()
                val jdbc = jdbcOf("order_backfill_fraction")
                jdbc.update("INSERT INTO orders (id, user_id, status, created_at) VALUES (1, 'u', 'COMPLETED', NOW())")
                jdbc.update("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (1, 10, 1, 12000.00), (1, 11, 1, 100.50)")

                shouldThrow<FlywayException> { flyway("order_backfill_fraction").migrate() }

                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'order_backfill_fraction' " +
                        "AND table_name = 'order_items' AND column_name = 'unit_price_won'",
                    Long::class.java,
                ) shouldBe 0L
            }
        }

        Given("읽기 모델(실제 발행 페이로드) → 주문서") {
            val admin = ProductRequester("1", setOf("ROLE_ADMIN"))
            val products = ctx.getBean(CreateProductUseCase::class.java)
            fun product(name: String, price: String, requester: ProductRequester) = products.execute(
                CreateProductUseCase.Command(name = name, price = price.toBigDecimal(), stock = 10),
                requester,
            ).id

            // 판매자 B — 신청 → 승인(수수료 12%, 배송비 3,000)
            val seller = ctx.getBean(ApplySellerUseCase::class.java).execute(
                ApplySellerUseCase.Command(
                    memberId = "order-seller-1", businessName = "주문서 상점", businessRegistrationNo = "222-33-44444",
                    representativeName = "대표", bankName = "은행", accountNumber = "110-222-333444",
                    shippingFee = 3_000L, settlementCycle = SettlementCycle.WEEKLY,
                ),
            )
            val manage = ctx.getBean(ManageSellerUseCase::class.java)
            manage.approve(ManageSellerUseCase.Approve(seller.id, "1", 1_200, "통합 검사"))
            relayToOrder()

            val platformProduct = product("플랫폼 머그", "20000", admin) // 판매자 1 (마이그레이션 시드)
            val sellerProduct = product("상점 컵", "12000.00", ProductRequester("order-seller-1", setOf("ROLE_USER", "ROLE_SELLER")))

            // 혜택 — 판매자 B 부담 정률 10%(최대 5,000, 최소 10,000) + 포인트 3,000
            val definition = ctx.getBean(ManageCouponDefinitionUseCase::class.java).create(
                ManageCouponDefinitionUseCase.Create(
                    name = "상점 10%", type = CouponType.RATE, amount = null, rateBp = 1_000, maxDiscount = 5_000L,
                    minOrderAmount = 10_000L, validFrom = Instant.now().minusSeconds(3600), validUntil = Instant.now().plusSeconds(86_400),
                    issueLimit = 10, bearer = CouponBearer.SELLER, sellerId = seller.id, actorId = "1",
                ),
            )
            val coupon = ctx.getBean(ClaimCouponUseCase::class.java).claim("buyer-1", definition.id)
            ctx.getBean(GrantPointsUseCase::class.java).grant(GrantPointsUseCase.Grant("buyer-1", 3_000L, "1", "통합 검사"))
            relayToOrder()

            Then("읽기 모델 행이 원천 값으로 채워진다 — 판매자 1 은 시드, 가격은 원 단위") {
                orderJdbc.queryForMap("SELECT status, commission_rate_bp, shipping_fee FROM seller_view WHERE seller_id = 1").let {
                    it["status"] shouldBe "ACTIVE"; it["commission_rate_bp"] shouldBe 0; it["shipping_fee"] shouldBe 0L
                }
                orderJdbc.queryForMap("SELECT status, commission_rate_bp, shipping_fee FROM seller_view WHERE seller_id = ?", seller.id).let {
                    it["status"] shouldBe "ACTIVE"; it["commission_rate_bp"] shouldBe 1_200; it["shipping_fee"] shouldBe 3_000L
                }
                orderJdbc.queryForMap("SELECT price, seller_id FROM product_view WHERE product_id = ?", sellerProduct).let {
                    it["price"] shouldBe 12_000L; it["seller_id"] shouldBe seller.id
                }
                orderJdbc.queryForObject("SELECT status FROM user_coupon_view WHERE user_coupon_id = ?", String::class.java, coupon.userCouponId) shouldBe "AVAILABLE"
                orderJdbc.queryForObject("SELECT balance FROM point_balance_view WHERE member_id = 'buyer-1'", Long::class.java) shouldBe 3_000L
            }

            Then("요청 JSON 의 가격·금액 필드는 Boot 매퍼에서 버려지고 금액은 읽기 모델에서만 온다 — 라인 스냅샷이 행으로 남는다") {
                val sheet = createSheet.execute(
                    sheetRequest(
                        """{"items":[{"productId":$sellerProduct,"quantity":2,"unitPrice":1},{"productId":$platformProduct,"quantity":1,"price":1}],
                           "userCouponId":${coupon.userCouponId},"pointAmount":1000,"payableAmount":1,"couponDiscount":99999}""",
                    ).toCommand("buyer-1"),
                )
                // 상점 24,000 (쿠폰 10% = 2,400) · 플랫폼 20,000 · 포인트 1,000 을 쿠폰 뒤 금액 21,600 : 20,000 으로 — 내림 519 · 480, 잔차 1 은 큰 라인
                sheet.itemsAmount shouldBe 44_000L
                sheet.couponDiscount shouldBe 2_400L
                sheet.shippingAmount shouldBe 3_000L
                sheet.payableAmount shouldBe 44_000L - 2_400L - 1_000L + 3_000L

                orderJdbc.queryForList(
                    "SELECT product_name, seller_id, unit_price, quantity, coupon_discount, coupon_bearer, point_amount, " +
                        "commission_rate_bp, payable_amount FROM order_sheet_line WHERE order_sheet_id = ? ORDER BY line_no",
                    sheet.id,
                ).map { listOf(it["product_name"], it["seller_id"], it["unit_price"], it["quantity"], it["coupon_discount"], it["coupon_bearer"], it["point_amount"], it["commission_rate_bp"], it["payable_amount"]) } shouldBe listOf(
                    listOf("상점 컵", seller.id, 12_000L, 2, 2_400L, "SELLER", 520L, 1_200, 21_080L),
                    listOf("플랫폼 머그", 1L, 20_000L, 1, 0L, null, 480L, 0, 19_520L),
                )
                orderJdbc.queryForList("SELECT seller_id, fee FROM order_sheet_shipping WHERE order_sheet_id = ? ORDER BY id", sheet.id)
                    .map { it["seller_id"] to it["fee"] } shouldBe listOf(seller.id to 3_000L, 1L to 0L)
                orderJdbc.queryForMap("SELECT status, member_id, payable_amount, TIMESTAMPDIFF(MINUTE, created_at, expires_at) AS ttl FROM order_sheet WHERE id = ?", sheet.id).let {
                    it["status"] shouldBe "ACTIVE"; it["member_id"] shouldBe "buyer-1"; it["payable_amount"] shouldBe 43_600L; it["ttl"] shouldBe 15L
                }

                // 조회 — 본인은 같은 값, 남은 없는 주문서와 같은 404
                getSheet.execute("buyer-1", sheet.id).payableAmount shouldBe 43_600L
                shouldThrow<OrderSheetNotFoundException> { getSheet.execute("buyer-2", sheet.id) }
            }

            Then("수수료율 스냅샷 — seller.updated 로 요율이 바뀌어도 이미 만든 주문서 라인은 그대로, 새 주문서만 새 요율") {
                val before = createSheet.execute(sheetRequest("""{"items":[{"productId":$sellerProduct,"quantity":1}]}""").toCommand("buyer-1"))

                manage.changeCommission(ManageSellerUseCase.ChangeCommission(seller.id, "1", 800, "요율 인하"))
                relayToOrder()
                orderJdbc.queryForObject("SELECT commission_rate_bp FROM seller_view WHERE seller_id = ?", Int::class.java, seller.id) shouldBe 800

                orderJdbc.queryForObject(
                    "SELECT commission_rate_bp FROM order_sheet_line WHERE order_sheet_id = ?", Int::class.java, before.id,
                ) shouldBe 1_200
                val after = createSheet.execute(sheetRequest("""{"items":[{"productId":$sellerProduct,"quantity":1}]}""").toCommand("buyer-1"))
                after.lines.single().commissionRateBp shouldBe 800
            }

            Then("판매자가 정지되면 그 판매자 상품 주문서는 422(SELLER_UNAVAILABLE) — 늦게 온 옛 승인 이벤트로 풀리지 않는다") {
                val approvedRow = sellerOutbox.findAll().last { it.eventType == "seller.seller.approved" && it.aggregateId == seller.id }
                manage.suspend(ManageSellerUseCase.Suspend(seller.id, "1", "통합 검사"))
                relayToOrder()

                // 아웃박스 재시도로 뒤늦게 도착한 옛 승인 — 새 eventId 라 멱등 원장은 못 거르고 시각 비교만 거른다
                val stale = (objectMapper.readTree(approvedRow.payload) as ObjectNode)
                    .put("eventId", java.util.UUID.randomUUID().toString())
                    .put("occurredAt", "2000-01-01T00:00:00Z")
                orderConsumer.onSeller(
                    ConsumerRecord("seller.seller.approved", 0, 0L, seller.id.toString(), objectMapper.writeValueAsString(stale)),
                )
                orderJdbc.queryForObject("SELECT status FROM seller_view WHERE seller_id = ?", String::class.java, seller.id) shouldBe "SUSPENDED"

                val count = orderJdbc.queryForObject("SELECT COUNT(*) FROM order_sheet", Long::class.java)
                shouldThrow<OrderSheetUnavailableException> {
                    createSheet.execute(
                        sheetRequest("""{"items":[{"productId":$platformProduct,"quantity":1},{"productId":$sellerProduct,"quantity":1}]}""").toCommand("buyer-1"),
                    )
                }.rejection shouldBe OrderSheetRejection.SELLER_UNAVAILABLE
                orderJdbc.queryForObject("SELECT COUNT(*) FROM order_sheet", Long::class.java) shouldBe count
            }

            Then("상품 이벤트 재발행 — 이벤트 이전 상품도 전부 읽기 모델에 들어간다") {
                orderJdbc.update("DELETE FROM product_view")
                val published = ctx.getBean(RepublishProductsUseCase::class.java).execute(admin)
                relayToOrder()
                orderJdbc.queryForObject("SELECT COUNT(*) FROM product_view", Int::class.java) shouldBe published
                orderJdbc.queryForObject("SELECT price FROM product_view WHERE product_id = ?", Long::class.java, platformProduct) shouldBe 20_000L
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
                            listOf(
                                "warehouse_db", "fulfillment_db", "order_db", "product_db", "deal_db", "seller_db", "payment_db",
                                "promotion_db", "order_backfill_ok", "order_backfill_fraction",
                            ).forEach { st.execute("CREATE DATABASE IF NOT EXISTS $it") }
                        }
                    }
                }
        }

        private fun jdbcUrl(db: String) = mysql.jdbcUrl.replace("/inventory_db", "/$db")

        private fun jdbcOf(db: String) = JdbcTemplate(
            org.springframework.jdbc.datasource.DriverManagerDataSource(jdbcUrl(db), mysql.username, mysql.password),
        )

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val inv = mysql.jdbcUrl
            fun ds(prefix: String, url: String) {
                registry.add("$prefix.jdbc-url") { url }
                registry.add("$prefix.username") { mysql.username }
                registry.add("$prefix.password") { mysql.password }
                registry.add("$prefix.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            for (role in listOf("master", "replica")) {
                ds("spring.datasource.$role", inv)
                for (domain in listOf("warehouse", "fulfillment", "order", "product", "seller", "payment", "promotion")) {
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
