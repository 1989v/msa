package com.kgd.commerce.ops

import com.kgd.commerce.CommerceApplication
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.kafka.config.KafkaListenerEndpointRegistry
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.sql.DataSource

/**
 * DLT → 운영 이슈 → 어드민 재발행을 실제 MySQL + 실제 Kafka + 실제 HTTP 로 돈다.
 * 판정은 DB 행(ops_issue)과 브로커가 받은 레코드 — 재발행이 원 토픽에 같은 값·원 헤더로 다시 도착했는가.
 */
@EnabledIf(OpsDockerOrCi::class)
@SpringBootTest(
    classes = [CommerceApplication::class],
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        "commerce.ops.dlt.metadata-max-age-ms=1000",
        "promotion.hold-expiry.initial-delay-ms=3600000",
    ],
)
class DltOpsIssueIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
    @Autowired private val env: Environment,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    init {
        val port = env.getRequiredProperty("local.server.port").toInt()
        val registry = ctx.getBean(KafkaListenerEndpointRegistry::class.java)
        val inventoryJdbc = JdbcTemplate(ctx.getBean("masterDataSource", DataSource::class.java))
        val orderJdbc = JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))
        val topic = "inventory.command.reserve"
        // 숫자가 아닌 orderId — 재고 컨슈머가 역직렬화에서 실패해 DLT 로 보낸다
        val poison = """{"eventId":"${UUID.randomUUID()}","orderId":"not-a-number","lines":[]}"""

        Given("재고 명령 컨슈머가 처리하지 못한 레코드") {
            infra.createTopics(topic, "$topic.DLT")
            infra.awaitTopicAssigned(registry, "inventory-service", topic)
            infra.awaitTopicAssigned(registry, "inventory-dlt-ops", "$topic.DLT")
            KafkaProducer<String, String>(
                mapOf(
                    ProducerConfig.BOOTSTRAP_SERVERS_CONFIG to infra.kafka.bootstrapServers,
                    ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
                    ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG to StringSerializer::class.java,
                ),
            ).use { producer ->
                producer.send(
                    ProducerRecord(topic, null, "880001", poison).apply { headers().add("x-probe", "dlt-1".toByteArray()) },
                ).get(10, TimeUnit.SECONDS)
            }

            Then("DLT 에는 원문 그대로(한 번 더 인용되지 않고) 가고, inventory_db 에 DLT 운영 이슈 한 건이 생긴다") {
                infra.readAll("$topic.DLT") { it.isNotEmpty() }.first().value() shouldBe poison

                infra.awaitTrue {
                    inventoryJdbc.queryForObject("SELECT COUNT(*) FROM ops_issue WHERE type = 'DLT'", Long::class.java) == 1L
                }
                val row = inventoryJdbc.queryForMap("SELECT target_id, detail, status, payload FROM ops_issue WHERE type = 'DLT'")
                (row["target_id"] as String) shouldContain "$topic@"
                (row["detail"] as String) shouldContain topic
                (row["detail"] as String) shouldContain "inventory-service"
                row["status"] shouldBe "OPEN"
                // 다른 도메인은 자기 그룹이 실패한 것이 아니므로 적재하지 않는다
                orderJdbc.queryForObject("SELECT COUNT(*) FROM ops_issue WHERE type = 'DLT'", Long::class.java) shouldBe 0L
            }

            Then("어드민 API 는 신원 헤더 없이 401, ROLE_USER 403") {
                infra.get(port, "/api/v1/admin/inventories/ops-issues", emptyMap()).statusCode() shouldBe 401
                infra.get(port, "/api/v1/admin/inventories/ops-issues", mapOf("X-User-Id" to "7", "X-User-Roles" to "ROLE_USER"))
                    .statusCode() shouldBe 403
                val list = infra.get(port, "/api/v1/admin/inventories/ops-issues?status=OPEN", ADMIN)
                list.statusCode() shouldBe 200
                list.body() shouldContain "\"type\":\"DLT\""
            }

            Then("재시도 → 원 토픽에 같은 키·값·원 헤더로 다시 도착하고, 이슈는 RETRIED(처리자·사유)") {
                val id = inventoryJdbc.queryForObject("SELECT id FROM ops_issue WHERE type = 'DLT'", Long::class.java)!!
                val res = infra.post(
                    port, "/api/v1/admin/inventories/ops-issues/$id/retry", ADMIN, """{"reason":"역직렬화 수정 후 재처리"}""",
                )
                res.statusCode() shouldBe 200

                val records = infra.readAll(topic) { r -> r.count { it.value() == poison } >= 2 }
                    .filter { it.value() == poison }
                records shouldHaveSize 2
                val replayed = records.last()
                replayed.key() shouldBe "880001"
                String(replayed.headers().lastHeader("x-probe").value()) shouldBe "dlt-1"
                replayed.headers().none { it.key().startsWith("kafka_dlt-") } shouldBe true

                inventoryJdbc.queryForMap("SELECT status, actor_id, reason FROM ops_issue WHERE id = ?", id).let {
                    it["status"] shouldBe "RETRIED"
                    it["actor_id"] shouldBe "ops-admin-1"
                    it["reason"] shouldBe "역직렬화 수정 후 재처리"
                }
            }

            Then("종결은 사유가 필요하고, 종결 뒤 재시도는 409") {
                val id = inventoryJdbc.queryForObject("SELECT MIN(id) FROM ops_issue WHERE type = 'DLT'", Long::class.java)!!
                infra.post(port, "/api/v1/admin/inventories/ops-issues/$id/close", ADMIN, """{"reason":""}""")
                    .statusCode() shouldBe 400
                infra.post(port, "/api/v1/admin/inventories/ops-issues/$id/close", ADMIN, """{"reason":"재처리 확인"}""")
                    .statusCode() shouldBe 200
                infra.post(port, "/api/v1/admin/inventories/ops-issues/$id/retry", ADMIN)
                    .statusCode() shouldBe 409
            }
        }
    }

    companion object {
        private val infra = OpsIntegrationInfra()
        private val ADMIN = OpsIntegrationInfra.ADMIN

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) = infra.register(registry)
    }
}
