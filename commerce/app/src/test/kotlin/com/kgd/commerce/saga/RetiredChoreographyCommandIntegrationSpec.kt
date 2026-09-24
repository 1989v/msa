package com.kgd.commerce.saga

import com.kgd.commerce.CommerceApplication
import com.kgd.inventory.application.reservation.usecase.ConvertLegacyReservationsUseCase
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.admin.AdminClient
import org.apache.kafka.clients.admin.AdminClientConfig
import org.apache.kafka.clients.admin.NewTopic
import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.kafka.config.KafkaListenerEndpointRegistry
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.kafka.KafkaContainer
import org.testcontainers.utility.DockerImageName
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.sql.DataSource
import kotlin.reflect.KClass

/**
 * 옛 코레오그래피 구독 은퇴 · 재고/이행 명령 · 옛 ACTIVE 예약 전환을 실제 MySQL(모든 도메인 Flyway + validate) +
 * 실제 Kafka 로 본다.
 *
 * 은퇴 판정은 둘이다. ① 리스너 레지스트리 — 은퇴한 (컨슈머 그룹, 토픽) 쌍을 구독하는 컨테이너가 없다(빠른 판정).
 * ② 행동 — 모든 리스너를 켠 채 옛 토픽에 레코드를 넣고 같은 브로커에 명령을 넣는다. 명령이 행을 만든 것(양성 대조)을
 * 확인한 뒤에도 옛 레코드의 주문에는 예약·이행 행이 0 이어야 한다.
 */
@EnabledIf(RetiredChoreographyCommandIntegrationSpec.DockerOrCi::class)
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
        "promotion.hold-expiry.initial-delay-ms=3600000",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    ],
)
class RetiredChoreographyCommandIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    init {
        val registry = ctx.getBean(KafkaListenerEndpointRegistry::class.java)
        val inventoryJdbc = JdbcTemplate(ctx.getBean("masterDataSource", DataSource::class.java))
        val fulfillmentJdbc = JdbcTemplate(ctx.getBean("fulfillmentMasterDataSource", DataSource::class.java))

        fun reservations(orderId: Long) =
            inventoryJdbc.queryForObject("SELECT COUNT(*) FROM reservation WHERE order_id = ?", Long::class.java, orderId)!!
        fun fulfillments(orderId: Long) =
            fulfillmentJdbc.queryForObject("SELECT COUNT(*) FROM fulfillment_order WHERE order_id = ?", Long::class.java, orderId)!!
        fun seedInventory(productId: Long, available: Int, reserved: Int = 0) = inventoryJdbc.update(
            "INSERT INTO inventory (product_id, warehouse_id, available_qty, reserved_qty, version) VALUES (?, 1, ?, ?, 0)",
            productId, available, reserved,
        )
        fun available(productId: Long) =
            inventoryJdbc.queryForObject("SELECT available_qty FROM inventory WHERE product_id = ?", Int::class.java, productId)
        fun reserved(productId: Long) =
            inventoryJdbc.queryForObject("SELECT reserved_qty FROM inventory WHERE product_id = ?", Int::class.java, productId)

        Given("옛 코레오그래피 구독") {
            Then("리스너 레지스트리에 은퇴한 (그룹, 토픽) 구독이 없고 명령 토픽 여섯이 구독돼 있다") {
                val subscriptions = registry.listenerContainers.flatMap { c ->
                    c.containerProperties.topics.orEmpty().map { c.groupId to it }
                }.toSet()

                subscriptions.filter { it in RETIRED }.shouldBeEmpty()
                subscriptions.map { it.second } shouldContainAll COMMAND_TOPICS
                // 옛 토픽을 아무 그룹도 구독하지 않는다(발행 은퇴 토픽 · 재고→이행 연쇄)
                subscriptions.map { it.second }.filter { it in setOf("order.order.completed", "order.order.cancelled") }
                    .shouldBeEmpty()
            }

            Then("모든 리스너를 켜고 옛 토픽에 레코드를 넣어도 예약·이행 행이 생기지 않는다 — 같은 브로커의 명령은 처리된다") {
                seedInventory(7001L, 10)
                (RETIRED.map { it.second } + COMMAND_TOPICS).distinct().forEach(::createTopic)
                registry.listenerContainers.forEach { it.start() }
                awaitAssignment(registry)

                KafkaProducer<String, String>(
                    mapOf(
                        ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to kafka.bootstrapServers,
                        ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
                        ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
                    ),
                ).use { producer ->
                    fun send(topic: String, key: String, json: String) = producer.send(ProducerRecord(topic, key, json)).get(10, TimeUnit.SECONDS)
                    // 옛 흐름이 내던 모양 그대로
                    send(
                        "order.order.completed", "770001",
                        """{"eventId":"${UUID.randomUUID()}","orderId":770001,"userId":"u","totalAmount":2000,"status":"COMPLETED",""" +
                            """"items":[{"productId":7001,"quantity":2,"unitPrice":1000}]}""",
                    )
                    send(
                        "inventory.stock.reserved", "770001",
                        """{"eventId":"${UUID.randomUUID()}","productId":7001,"warehouseId":1,"qty":2,"orderId":770001,"availableQty":8}""",
                    )
                    // 양성 대조 — 새 명령
                    send(
                        "inventory.command.reserve", "770002",
                        """{"eventId":"${UUID.randomUUID()}","orderId":770002,"lines":[{"productId":7001,"quantity":3}]}""",
                    )
                    send(
                        "fulfillment.command.create", "770003",
                        """{"eventId":"${UUID.randomUUID()}","orderId":770003,"lines":[{"productId":7001,"quantity":1,"warehouseId":1}]}""",
                    )
                }

                awaitTrue { reservations(770002L) == 1L && fulfillments(770003L) == 1L }
                Thread.sleep(2_000) // 옛 레코드가 늦게 처리될 여유 — 구독자가 있었다면 이 사이에 행이 생긴다

                reservations(770001L) shouldBe 0L
                fulfillments(770001L) shouldBe 0L
                available(7001L) shouldBe 7
                inventoryJdbc.queryForObject(
                    "SELECT partition_key FROM outbox_event WHERE event_type = 'inventory.reservation.reserved'", String::class.java,
                ) shouldBe "770002"
                fulfillmentJdbc.queryForObject(
                    "SELECT partition_key FROM outbox_event WHERE event_type = 'fulfillment.order.created'", String::class.java,
                ) shouldBe "770003"
                registry.listenerContainers.forEach { it.stop() }
            }
        }

        Given("새 유니크 제약 (Flyway)") {
            Then("같은 (주문, 상품, 창고) 예약 · 같은 (상품, 창고) 재고 · 같은 (주문, 창고) 이행은 두 번 들어가지 않는다") {
                seedInventory(7003L, 1)
                shouldThrow<DataIntegrityViolationException> { seedInventory(7003L, 1) }
                val insertReservation = "INSERT INTO reservation (order_id, product_id, warehouse_id, qty, status, expired_at, created_at) " +
                    "VALUES (990901, 7003, 1, 1, 'CANCELLED', NOW(6), NOW(6))"
                inventoryJdbc.update(insertReservation)
                shouldThrow<DataIntegrityViolationException> { inventoryJdbc.update(insertReservation) }
                val insertFulfillment = "INSERT INTO fulfillment_order (order_id, warehouse_id, status, created_at) VALUES (990901, 1, 'PENDING', NOW(6))"
                fulfillmentJdbc.update(insertFulfillment)
                shouldThrow<DataIntegrityViolationException> { fulfillmentJdbc.update(insertFulfillment) }
            }
        }

        Given("옛 흐름이 남긴 ACTIVE 예약") {
            Then("전환을 두 번 돌려도 reserved_qty 는 한 번만 줄고 stock.confirmed 는 한 번 — 사가 예약은 그대로") {
                val conversion = ctx.getBean(ConvertLegacyReservationsUseCase::class.java)
                // 기동 때 이미 한 번 돌았다(빈 DB) — 표식을 지우고 옛 예약을 심어 다시 돌린다
                inventoryJdbc.queryForObject("SELECT COUNT(*) FROM inventory_migration_marker", Long::class.java) shouldBe 1L
                inventoryJdbc.update("DELETE FROM inventory_migration_marker")
                seedInventory(7002L, 6, reserved = 4)
                inventoryJdbc.update(
                    "INSERT INTO reservation (order_id, product_id, warehouse_id, qty, status, expired_at, created_at) " +
                        "VALUES (880001, 7002, 1, 4, 'ACTIVE', NOW(6) - INTERVAL 1 DAY, NOW(6) - INTERVAL 1 DAY)",
                )
                fun confirmedEvents() = inventoryJdbc.queryForObject(
                    "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'inventory.stock.confirmed' AND JSON_EXTRACT(payload, '$.productId') = 7002",
                    Long::class.java,
                )

                conversion.convert() shouldBe 1
                conversion.convert() shouldBe null

                reserved(7002L) shouldBe 0
                available(7002L) shouldBe 6
                inventoryJdbc.queryForObject("SELECT status FROM reservation WHERE order_id = 880001", String::class.java) shouldBe "CONFIRMED"
                confirmedEvents() shouldBe 1L
                // 사가가 예약한 주문(답 원장에 RESERVE)은 ACTIVE 로 남는다
                inventoryJdbc.queryForObject("SELECT status FROM reservation WHERE order_id = 770002", String::class.java) shouldBe "ACTIVE"
            }
        }
    }

    class DockerOrCi : EnabledCondition {
        override fun enabled(kclass: KClass<out Spec>): Boolean = dockerAvailable || isCi
    }

    companion object {
        /** SR-1 — 은퇴한 (컨슈머 그룹, 토픽). 같은 토픽을 다른 그룹이 새 흐름으로 구독하는 것은 은퇴 대상이 아니다 */
        private val RETIRED = setOf(
            "inventory-service" to "order.order.completed",
            "inventory-service" to "order.order.cancelled",
            "inventory-service" to "fulfillment.order.shipped",
            "inventory-service" to "fulfillment.order.cancelled",
            "fulfillment-service" to "inventory.stock.reserved",
            // 주문 즉시 취소하던 order 구독 — 이제 사가 코디네이터(order-saga)가 보류 만료 규칙으로 받는다
            "order-service" to "inventory.reservation.expired",
        )
        private val COMMAND_TOPICS = listOf(
            "inventory.command.reserve", "inventory.command.confirm", "inventory.command.release", "inventory.command.restock",
            "fulfillment.command.create", "fulfillment.command.cancel",
        )

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
                            listOf("warehouse_db", "fulfillment_db", "order_db", "product_db", "deal_db", "seller_db", "payment_db", "promotion_db")
                                .forEach { st.execute("CREATE DATABASE IF NOT EXISTS $it") }
                        }
                    }
                }
        }

        private val kafka: KafkaContainer by lazy {
            // 3.9 이미지는 이 Testcontainers 버전의 advertised.listeners(0.0.0.0) 와 맞지 않아 기동하지 않는다.
            KafkaContainer(DockerImageName.parse("apache/kafka:3.8.1")).also { it.start() }
        }

        fun createTopic(topic: String) {
            AdminClient.create(mapOf(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG to kafka.bootstrapServers)).use {
                if (topic !in it.listTopics().names().get()) {
                    it.createTopics(listOf(NewTopic(topic, 1, 1.toShort()))).all().get(30, TimeUnit.SECONDS)
                }
            }
        }

        /** 은퇴 여부를 보는 두 그룹의 컨테이너가 파티션을 받을 때까지 — 받기 전 레코드는 earliest 로 읽히지만 확인은 해 둔다 */
        fun awaitAssignment(registry: KafkaListenerEndpointRegistry) = awaitTrue {
            registry.listenerContainers
                .filter { it.groupId in setOf("inventory-service", "fulfillment-service") }
                .all { !it.assignedPartitions.isNullOrEmpty() }
        }

        fun awaitTrue(condition: () -> Boolean) {
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60)
            while (System.nanoTime() < deadline) {
                if (condition()) return
                Thread.sleep(200)
            }
            error("60초 안에 조건이 참이 되지 않았다")
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val inv = mysql.jdbcUrl
            registry.add("spring.kafka.bootstrap-servers") { kafka.bootstrapServers }
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
