package com.kgd.commerce.outbox

import com.kgd.commerce.CommerceApplication
import com.kgd.common.messaging.outbox.OutboxPollingPublisher
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.order.infrastructure.outbox.OrderOutboxRepository
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.admin.AdminClient
import org.apache.kafka.clients.admin.AdminClientConfig
import org.apache.kafka.clients.admin.NewTopic
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.common.TopicPartition
import org.apache.kafka.common.serialization.StringDeserializer
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.kafka.KafkaContainer
import org.testcontainers.utility.DockerImageName
import tools.jackson.databind.ObjectMapper
import java.time.Duration
import java.time.LocalDateTime
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.sql.DataSource
import kotlin.reflect.KClass

/**
 * 아웃박스 릴레이를 실제 MySQL(order_db, Flyway 적용) + 실제 Kafka 로 돌린다.
 * 판정은 브로커가 받은 레코드와 DB 행 상태 — 목으로는 직렬화기와 `SKIP LOCKED` 를 잴 수 없다.
 *
 * Docker 가 없으면 로컬에선 건너뛰지만 `CI=true` 면 그대로 실행해 **실패**한다(초록불로 넘어가지 않게).
 */
@EnabledIf(OutboxRelayIntegrationSpec.DockerOrCi::class)
@SpringBootTest(
    classes = [CommerceApplication::class],
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        // 스케줄 릴레이가 테스트가 부르는 릴레이와 섞이지 않게 첫 실행을 미룬다.
        "outbox.polling.initial-delay-ms=3600000",
        "outbox.cleanup.initial-delay-ms=3600000",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    ],
)
class OutboxRelayIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    init {
        val port = ctx.getBean("orderOutboxPort", OutboxPort::class.java)
        val relay = ctx.getBean("orderOutboxPollingPublisher", OutboxPollingPublisher::class.java)
        val transactionManager = ctx.getBean("orderTransactionManager", PlatformTransactionManager::class.java)
        val jdbc = JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))
        val tx = TransactionTemplate(transactionManager)

        fun reset() {
            jdbc.update("DELETE FROM outbox_event")
        }

        fun status(aggregateType: String): Map<String, Int> =
            jdbc.queryForList(
                "SELECT status, COUNT(*) AS c FROM outbox_event WHERE aggregate_type = ? GROUP BY status",
                aggregateType,
            ).associate { it["status"] as String to (it["c"] as Number).toInt() }

        given("order 스키마의 아웃박스 릴레이") {

            `when`("partition_key·headers 가 있는 행과 없는 행을 발행하면") {
                then("컨슈머는 원문 JSON 을 받고, 키는 partition_key(없으면 aggregateId), 헤더가 복원된다") {
                    reset()
                    val topic = "outbox.it.raw"
                    createTopic(topic)
                    tx.executeWithoutResult {
                        port.save(
                            "Order", 7L, topic, """{"orderId":7}""",
                            partitionKey = "order-7",
                            headers = mapOf("traceparent" to "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"),
                        )
                        port.save("Order", 8L, topic, """{"orderId":8}""")
                    }

                    relay.publishPendingEvents()

                    val records = consume(topic, expected = 2)
                    records.size shouldBe 2
                    records.forEach { it.value().first() shouldBe '{' }
                    val first = records.single { it.key() == "order-7" }
                    ObjectMapper().readTree(first.value()).get("orderId").asLong() shouldBe 7L
                    String(first.headers().lastHeader("traceparent").value()) shouldBe
                        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
                    records.single { it.key() == "8" }.headers().lastHeader("traceparent") shouldBe null
                    status("Order") shouldBe mapOf("PUBLISHED" to 2)
                }
            }

            `when`("릴레이 두 개가 동시에 150행을 나눠 집으면") {
                then("모든 행이 정확히 한 번씩 발행된다") {
                    reset()
                    val topic = "outbox.it.concurrent"
                    createTopic(topic)
                    tx.executeWithoutResult {
                        (1L..150L).forEach { port.save("Concurrent", it, topic, """{"n":$it}""") }
                    }
                    val second = OutboxPollingPublisher(
                        name = "order-second",
                        outboxRepository = ctx.getBean(OrderOutboxRepository::class.java),
                        kafkaTemplate = ctx.getBean("orderOutboxKafkaTemplate", KafkaTemplate::class.java)
                            .let { @Suppress("UNCHECKED_CAST") (it as KafkaTemplate<String, String>) },
                        transactionManager = transactionManager,
                        objectMapper = ObjectMapper(),
                    )

                    val start = CountDownLatch(1)
                    val pool = Executors.newFixedThreadPool(2)
                    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60)
                    try {
                        listOf(relay, second).map { r ->
                            pool.submit {
                                start.await()
                                while (status("Concurrent")["PUBLISHED"] != 150 && System.nanoTime() < deadline) {
                                    r.publishPendingEvents()
                                }
                            }
                        }.also { start.countDown() }.forEach { it.get(90, TimeUnit.SECONDS) }
                    } finally {
                        // 한쪽이 예외로 끝나도 다른 쪽이 계속 돌면 뒤 테스트의 행을 집어 간다.
                        pool.shutdownNow()
                        pool.awaitTermination(30, TimeUnit.SECONDS)
                    }

                    status("Concurrent") shouldBe mapOf("PUBLISHED" to 150)
                    val records = consume(topic, expected = 150, settle = Duration.ofSeconds(3))
                    val perEvent = records.groupingBy { ObjectMapper().readTree(it.value()).get("eventId").asString() }
                        .eachCount()
                    perEvent.size shouldBe 150
                    perEvent.filterValues { it != 1 }.keys.toList().shouldBeEmpty()
                }
            }

            `when`("SENDING 행의 리스가 끝났으면") {
                then("다시 집어 발행하고, 리스가 남은 SENDING 은 건드리지 않는다") {
                    reset()
                    val topic = "outbox.it.lease"
                    createTopic(topic)
                    tx.executeWithoutResult {
                        port.save("LeaseExpired", 1L, topic, """{"n":1}""")
                        port.save("LeaseHeld", 2L, topic, """{"n":2}""")
                    }
                    val now = LocalDateTime.now()
                    jdbc.update(
                        "UPDATE outbox_event SET status = 'SENDING', lease_until = ? WHERE aggregate_type = 'LeaseExpired'",
                        now.minusSeconds(1),
                    )
                    jdbc.update(
                        "UPDATE outbox_event SET status = 'SENDING', lease_until = ? WHERE aggregate_type = 'LeaseHeld'",
                        now.plusSeconds(60),
                    )

                    relay.publishPendingEvents()

                    status("LeaseExpired") shouldBe mapOf("PUBLISHED" to 1)
                    status("LeaseHeld") shouldBe mapOf("SENDING" to 1)
                    consume(topic, expected = 1).map { it.key() } shouldBe listOf("1")
                }
            }

            `when`("전송이 10번 실패하면") {
                then("FAILED 로 멈추고 그 뒤로는 집지 않는다") {
                    reset()
                    // 공백은 토픽 이름으로 쓸 수 없다 — 프로듀서가 거절한다.
                    tx.executeWithoutResult { port.save("Failing", 1L, "invalid topic", """{"n":1}""") }

                    repeat(10) {
                        jdbc.update("UPDATE outbox_event SET next_attempt_at = NULL WHERE status = 'PENDING'")
                        relay.publishPendingEvents()
                    }
                    jdbc.queryForMap("SELECT status, attempts FROM outbox_event WHERE aggregate_type = 'Failing'")
                        .let { (it["status"] to (it["attempts"] as Number).toInt()) } shouldBe ("FAILED" to 10)

                    relay.publishPendingEvents()
                    (jdbc.queryForObject(
                        "SELECT attempts FROM outbox_event WHERE aggregate_type = 'Failing'", Int::class.java,
                    )) shouldBe 10
                }
            }

            `when`("정리 스케줄이 돌면") {
                then("7일 넘은 PUBLISHED 만 지우고 최근 PUBLISHED·미발행 행은 남긴다") {
                    reset()
                    tx.executeWithoutResult {
                        port.save("Old", 1L, "outbox.it.purge", """{"n":1}""")
                        port.save("Recent", 2L, "outbox.it.purge", """{"n":2}""")
                        port.save("Pending", 3L, "outbox.it.purge", """{"n":3}""")
                    }
                    val now = LocalDateTime.now()
                    jdbc.update(
                        "UPDATE outbox_event SET status = 'PUBLISHED', published_at = ? WHERE aggregate_type = 'Old'",
                        now.minusDays(8),
                    )
                    jdbc.update(
                        "UPDATE outbox_event SET status = 'PUBLISHED', published_at = ? WHERE aggregate_type = 'Recent'",
                        now.minusDays(1),
                    )

                    relay.purgePublished() shouldBe 1

                    jdbc.queryForList("SELECT aggregate_type FROM outbox_event ORDER BY id", String::class.java) shouldBe
                        listOf("Recent", "Pending")
                }
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
            MySQLContainer(DockerImageName.parse("mysql:8.0"))
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
                    it.createTopics(listOf(NewTopic(topic, 3, 1.toShort()))).all().get(30, TimeUnit.SECONDS)
                }
            }
        }

        /** 토픽 전체를 처음부터 읽는다. [expected] 개를 채운 뒤에도 [settle] 동안 더 읽어 중복을 잡는다. */
        fun consume(
            topic: String,
            expected: Int,
            settle: Duration = Duration.ofMillis(500),
        ): List<ConsumerRecord<String, String>> {
            val props = mapOf<String, Any>(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG to kafka.bootstrapServers,
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG to StringDeserializer::class.java,
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG to false,
            )
            KafkaConsumer<String, String>(props).use { consumer ->
                val partitions = consumer.partitionsFor(topic).map { TopicPartition(topic, it.partition()) }
                consumer.assign(partitions)
                consumer.seekToBeginning(partitions)
                val out = mutableListOf<ConsumerRecord<String, String>>()
                val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30)
                var settleUntil = Long.MAX_VALUE
                while (System.nanoTime() < minOf(deadline, settleUntil)) {
                    out += consumer.poll(Duration.ofMillis(200))
                    if (out.size >= expected && settleUntil == Long.MAX_VALUE) {
                        settleUntil = System.nanoTime() + settle.toNanos()
                    }
                }
                return out
            }
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
