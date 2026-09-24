package com.kgd.commerce.saga

import com.kgd.commerce.CommerceApplication
import com.kgd.fulfillment.infrastructure.messaging.FulfillmentCommandMessage
import com.kgd.inventory.infrastructure.messaging.InventoryCommandMessage
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.application.saga.port.OrderSagaRepositoryPort
import com.kgd.order.application.saga.service.OrderSagaCoordinator
import com.kgd.order.application.saga.usecase.InventoryAnswer
import com.kgd.order.application.saga.usecase.InventoryAnswerType
import com.kgd.order.application.saga.usecase.PaymentOutcome
import com.kgd.order.application.saga.usecase.PaymentOutcomeType
import com.kgd.order.application.saga.usecase.PromotionAnswer
import com.kgd.order.application.saga.usecase.PromotionAnswerType
import com.kgd.order.application.sheet.port.OrderSheetRepositoryPort
import com.kgd.order.domain.benefit.model.CouponBearer
import com.kgd.order.domain.order.exception.IdempotencyKeyInProgressException
import com.kgd.order.domain.saga.model.ReservedLine
import com.kgd.order.domain.sheet.exception.OrderSheetUnavailableException
import com.kgd.order.domain.sheet.model.OrderSheet
import com.kgd.order.domain.sheet.model.OrderSheetLine
import com.kgd.order.domain.sheet.model.ShippingLine
import com.kgd.payment.infrastructure.messaging.PaymentCommandMessage
import com.kgd.promotion.infrastructure.messaging.PromotionCommandMessage
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import org.flywaydb.core.Flyway
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.orm.ObjectOptimisticLockingFailureException
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.sql.DataSource
import kotlin.reflect.KClass

/**
 * 사가 · 주문 상태 · 멱등 키를 실제 MySQL(모든 도메인 Flyway + `ddl-auto=validate`)로 본다. Kafka 는 쓰지 않는다 —
 * 답은 코디네이터 유스케이스에 직접 넣고, 판정은 order_db 행(주문 · 상태 이력 · 사가 · 아웃박스)이다.
 * 명령 아웃박스 행은 **받는 쪽 컨슈머의 메시지 클래스**로 엄격 역직렬화해 계약을 확인한다.
 */
@EnabledIf(OrderSagaIdempotencyIntegrationSpec.DockerOrCi::class)
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
        "order.saga.deadline-initial-delay-ms=3600000",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    ],
)
class OrderSagaIdempotencyIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    init {
        val jdbc = JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))
        val tx = TransactionTemplate(ctx.getBean("orderTransactionManager", PlatformTransactionManager::class.java))
        val sheets = ctx.getBean(OrderSheetRepositoryPort::class.java)
        val place = ctx.getBean(PlaceOrderUseCase::class.java)
        val coordinator = ctx.getBean(OrderSagaCoordinator::class.java)
        val sagas = ctx.getBean(OrderSagaRepositoryPort::class.java)
        val mapper = ctx.getBean(ObjectMapper::class.java)

        /** 모르는 필드가 있으면 실패 — 보내는 쪽 필드 이름이 받는 쪽과 어긋나면 여기서 깨진다 */
        fun <T> strict(payload: String, type: Class<T>): T =
            mapper.readerFor(type).with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(payload)

        fun sheet(memberId: String): Long = requireNotNull(
            tx.execute {
                sheets.save(
                    OrderSheet.create(
                        memberId = memberId,
                        lines = listOf(
                            OrderSheetLine(1, 101L, "머그", 7L, 10_000L, 2, 2_000, CouponBearer.SELLER, 1_000, 1_200),
                            OrderSheetLine(2, 102L, "컵", 1L, 5_000L, 1, 0, null, 0, 0),
                        ),
                        shippingLines = listOf(ShippingLine(7L, 3_000L), ShippingLine(1L, 0L)),
                        userCouponId = null, couponDefinitionId = null,
                        expiresAt = Instant.now().plusSeconds(900), createdAt = Instant.now(),
                    ),
                ).id
            },
        )

        fun outbox(orderId: Long) = jdbc.queryForList(
            "SELECT event_type, payload, partition_key FROM outbox_event WHERE aggregate_id = ? ORDER BY id", orderId,
        )

        Given("상태값 전환 마이그레이션 (SR-13)") {
            Then("COMPLETED → CONFIRMED, PENDING → FAILED(LEGACY_ABANDONED), 나머지는 그대로 — 전환마다 이력 한 줄") {
                fun flyway(target: String? = null) = Flyway.configure()
                    .dataSource(jdbcUrl("order_status_migration"), mysql.username, mysql.password)
                    .locations("classpath:orderdb/migration")
                    .apply { target?.let { target(it) } }
                    .load()
                flyway(target = "20260924.004").migrate()
                val legacy = jdbcOf("order_status_migration")
                legacy.update(
                    "INSERT INTO orders (id, user_id, status, created_at) VALUES " +
                        "(1, 'u', 'COMPLETED', NOW()), (2, 'u', 'PENDING', NOW()), (3, 'u', 'CANCELLED', NOW())",
                )

                flyway().migrate()

                legacy.queryForList("SELECT id, status, failure_reason FROM orders ORDER BY id").map {
                    Triple(it["id"], it["status"], it["failure_reason"])
                } shouldContainExactly listOf(
                    Triple(1L, "CONFIRMED", null), Triple(2L, "FAILED", "LEGACY_ABANDONED"), Triple(3L, "CANCELLED", null),
                )
                legacy.queryForList("SELECT order_id, from_status, to_status, actor FROM order_status_history ORDER BY order_id").map {
                    listOf(it["order_id"], it["from_status"], it["to_status"], it["actor"])
                } shouldContainExactly listOf(
                    listOf(1L, "COMPLETED", "CONFIRMED", "MIGRATION"), listOf(2L, "PENDING", "FAILED", "MIGRATION"),
                )
            }
        }

        Given("Idempotency-Key (실제 유니크 제약)") {
            Then("완료 뒤 같은 키는 처음 응답 그대로 — 주문 1건, 다른 키로 같은 주문서는 422") {
                val sheetId = sheet("idem-1")
                val first = place.place(PlaceOrderUseCase.Command("idem-1", "key-1", sheetId))
                val second = place.place(PlaceOrderUseCase.Command("idem-1", "key-1", sheetId))
                second shouldBe first
                jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE user_id = 'idem-1'", Long::class.java) shouldBe 1L
                jdbc.queryForObject(
                    "SELECT status FROM idempotency_key WHERE user_id = 'idem-1' AND idem_key = 'key-1'", String::class.java,
                ) shouldBe "COMPLETED"
                shouldThrow<OrderSheetUnavailableException> { place.place(PlaceOrderUseCase.Command("idem-1", "key-2", sheetId)) }
                jdbc.queryForObject("SELECT COUNT(*) FROM idempotency_key WHERE idem_key = 'key-2'", Long::class.java) shouldBe 0L
            }
            Then("처리 중(리스 유효)이면 409, 리스가 지나면 이어받아 주문이 생긴다") {
                jdbc.update(
                    "INSERT INTO idempotency_key (user_id, idem_key, status, lease_until, created_at) " +
                        "VALUES ('idem-2', 'key-1', 'PROCESSING', NOW(6) + INTERVAL 1 MINUTE, NOW(6))",
                )
                shouldThrow<IdempotencyKeyInProgressException> { place.place(PlaceOrderUseCase.Command("idem-2", "key-1", sheet("idem-2"))) }
                jdbc.update("UPDATE idempotency_key SET lease_until = NOW(6) - INTERVAL 1 SECOND WHERE user_id = 'idem-2'")
                place.place(PlaceOrderUseCase.Command("idem-2", "key-1", sheet("idem-2"))).status shouldBe "CREATED"
                jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE user_id = 'idem-2'", Long::class.java) shouldBe 1L
            }
        }

        Given("사가 한 바퀴 (답은 유스케이스로 직접)") {
            val orderId = place.place(PlaceOrderUseCase.Command("saga-1", "k", sheet("saga-1"))).orderId
            coordinator.onInventory(InventoryAnswer(orderId, InventoryAnswerType.RESERVED, "RESERVE", lines = listOf(ReservedLine(101L, 1L, 2), ReservedLine(102L, 1L, 1))))
            coordinator.onPromotion(PromotionAnswer(orderId, PromotionAnswerType.RESERVED, "RESERVE"))
            coordinator.onPayment(PaymentOutcome(orderId, PaymentOutcomeType.AUTHORIZED))
            coordinator.onInventory(InventoryAnswer(orderId, InventoryAnswerType.CONFIRMED, "CONFIRM", lines = listOf(ReservedLine(101L, 1L, 2), ReservedLine(102L, 1L, 1))))
            coordinator.onPromotion(PromotionAnswer(orderId, PromotionAnswerType.CONFIRMED, "CONFIRM"))
            coordinator.onPayment(PaymentOutcome(orderId, PaymentOutcomeType.CAPTURED))
            coordinator.onFulfillmentCreated(orderId)

            Then("주문 FULFILLING · 사가 COMPLETED · 상태 이력은 전이마다 한 줄") {
                jdbc.queryForMap("SELECT status, payable_amount FROM orders WHERE id = ?", orderId).let {
                    it["status"] shouldBe "FULFILLING"
                    it["payable_amount"] shouldBe 25_000L
                }
                jdbc.queryForMap("SELECT status, step FROM order_saga WHERE order_id = ?", orderId).let {
                    it["status"] shouldBe "COMPLETED"; it["step"] shouldBe "FULFILLMENT_CREATE"
                }
                jdbc.queryForList(
                    "SELECT from_status, to_status FROM order_status_history WHERE order_id = ? ORDER BY id", orderId,
                ).map { it["from_status"] to it["to_status"] } shouldContainExactly listOf(
                    null to "CREATED", "CREATED" to "PAYMENT_PENDING", "PAYMENT_PENDING" to "PAID", "PAID" to "CONFIRMED",
                    "CONFIRMED" to "FULFILLING",
                )
            }
            Then("명령 아웃박스 행은 키 = orderId 이고 받는 쪽 메시지 클래스로 엄격 역직렬화된다") {
                val rows = outbox(orderId)
                rows.map { it["event_type"] } shouldContainExactly listOf(
                    "inventory.command.reserve", "promotion.command.reserve", "payment.command.authorize",
                    "inventory.command.confirm", "promotion.command.confirm", "payment.command.capture",
                    "order.order.confirmed", "fulfillment.command.create",
                )
                rows.forEach { it["partition_key"] shouldBe orderId.toString() }
                rows.forEach { row ->
                    val payload = row["payload"] as String
                    when ((row["event_type"] as String).substringBefore(".command")) {
                        "inventory" -> strict(payload, InventoryCommandMessage::class.java).orderId shouldBe orderId
                        "promotion" -> strict(payload, PromotionCommandMessage::class.java).orderId shouldBe orderId
                        "payment" -> strict(payload, PaymentCommandMessage::class.java).orderNo shouldBe "ORD-$orderId-1"
                        "fulfillment" -> strict(payload, FulfillmentCommandMessage::class.java).lines!!.map { it.warehouseId } shouldBe listOf(1L, 1L)
                    }
                }
                strict(rows[2]["payload"] as String, PaymentCommandMessage::class.java).amount shouldBe 25_000L
            }
            Then("order.order.confirmed 에 라인(판매자·안분·수수료)과 판매자별 배송비가 실린다") {
                val node = mapper.readTree(outbox(orderId).first { it["event_type"] == "order.order.confirmed" }["payload"] as String)
                node.get("lines").size() shouldBe 2
                node.get("lines").get(0).get("sellerCouponAllocation").asLong() shouldBe 2_000L
                node.get("lines").get(0).get("commission").asLong() shouldBe 2_160L
                node.get("lines").get(0).get("orderItemId").isNull shouldBe false
                node.get("shippingLines").get(0).get("fee").asLong() shouldBe 3_000L
            }
        }

        Given("order_saga @Version") {
            Then("읽은 뒤 다른 트랜잭션이 커밋한 사가를 저장하면 충돌이다") {
                val orderId = place.place(PlaceOrderUseCase.Command("ver-1", "k", sheet("ver-1"))).orderId
                shouldThrow<ObjectOptimisticLockingFailureException> {
                    tx.executeWithoutResult {
                        val stale = requireNotNull(sagas.findByOrderId(orderId))
                        JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))
                            .update("UPDATE order_saga SET version = version + 1 WHERE order_id = ?", orderId)
                        stale.markHoldsExpired() // 바뀐 것이 있어야 UPDATE 가 나간다
                        sagas.save(stale)
                    }
                }
            }
            Then("같은 답 8개가 동시에 와도 한쪽만 진행하고 나머지는 다시 읽어 무시 — 다음 명령은 한 번") {
                val orderId = place.place(PlaceOrderUseCase.Command("ver-2", "k", sheet("ver-2"))).orderId
                val pool = Executors.newFixedThreadPool(8)
                val start = CountDownLatch(1)
                val done = (1..8).map {
                    pool.submit {
                        start.await()
                        coordinator.onInventory(InventoryAnswer(orderId, InventoryAnswerType.RESERVED, "RESERVE", lines = listOf(ReservedLine(101L, 1L, 2))))
                    }
                }
                start.countDown()
                done.forEach { it.get(30, TimeUnit.SECONDS) }
                pool.shutdown()
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM outbox_event WHERE aggregate_id = ? AND event_type = 'promotion.command.reserve'", Long::class.java, orderId,
                ) shouldBe 1L
                jdbc.queryForObject("SELECT step FROM order_saga WHERE order_id = ?", String::class.java, orderId) shouldBe "PROMOTION_RESERVE"
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
                                "promotion_db", "order_status_migration",
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
