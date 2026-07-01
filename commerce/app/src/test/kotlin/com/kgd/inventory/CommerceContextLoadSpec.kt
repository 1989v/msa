package com.kgd.inventory

import com.kgd.commerce.CommerceApplication
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationContext
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName

/**
 * ADR-0058 — commerce 모듈러 모놀리스 **전체 컨텍스트 로드** 검증.
 *
 * inventory + warehouse + fulfillment 3개 도메인 feature 를 한 JVM(InventoryApplication→commerce)에
 * 컴포넌트 스캔으로 띄워, ① 빈 이름 충돌이 없고 ② 도메인별 EMF/TM + 전용 outbox/idempotency 가
 * 각자 datasource/TM 에 바인딩되어 로드되는지 확인한다. 컨텍스트가 뜨면 cross-domain 빈 충돌이
 * 모두 해소됐다는 의미(Spring 은 default 로 bean override 비활성 → 충돌 시 로드 실패).
 *
 * Kafka 리스너는 auto-startup=false, ddl-auto=create(Flyway off) 로 외부 인프라 없이 로드.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun commerceDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [CommerceApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        "outbox.polling.enabled=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "spring.kafka.bootstrap-servers=localhost:9092",
        // 도메인별 cleanup 스케줄러가 다중 port 로 모호하지 않은지(k8s 경로) 검증.
        "kgd.common.messaging.idempotent.cleanup.enabled=true",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.inventory.CommerceContextLoadSpecKt#commerceDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class CommerceContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec({

    Given("commerce 모듈러 모놀리스 (inventory + warehouse + fulfillment 한 JVM)") {
        Then("3 도메인 EMF/TM + 전용 outbox/idempotency 가 충돌 없이 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                // 3 persistence units (도메인별 datasource 격리)
                listOf(
                    "inventoryEntityManagerFactory", "inventoryTransactionManager",
                    "warehouseEntityManagerFactory", "warehouseTransactionManager",
                    "fulfillmentEntityManagerFactory", "fulfillmentTransactionManager",
                    "orderEntityManagerFactory", "orderTransactionManager",
                    "memberEntityManagerFactory", "memberTransactionManager",
                    "wishlistEntityManagerFactory", "wishlistTransactionManager",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }

                // 도메인별 전용 outbox/idempotency (각자 TM 바인딩)
                ctx.containsBean("fulfillmentOutboxPort").shouldBeTrue()
                ctx.containsBean("fulfillmentOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("fulfillmentIdempotentEventHandler").shouldBeTrue()
                ctx.containsBean("orderOutboxPort").shouldBeTrue()
                ctx.containsBean("orderOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("orderIdempotentEventHandler").shouldBeTrue()
                ctx.containsBean("inventoryIdempotentEventHandler").shouldBeTrue()
                // 도메인별 retention cleanup 스케줄러 (common 단일 스케줄러의 다중-port 모호성 회피)
                ctx.containsBean("inventoryIdempotentEventCleanupScheduler").shouldBeTrue()
                ctx.containsBean("fulfillmentIdempotentEventCleanupScheduler").shouldBeTrue()
                ctx.containsBean("orderIdempotentEventCleanupScheduler").shouldBeTrue()
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("inventory_db")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use {
                            it.execute("CREATE DATABASE IF NOT EXISTS warehouse_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS fulfillment_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS order_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS member_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS wishlist_db")
                        }
                    }
                }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            if (mysql == null) return
            val inv = mysql.jdbcUrl
            val wh = inv.replace("/inventory_db", "/warehouse_db")
            val ful = inv.replace("/inventory_db", "/fulfillment_db")
            val ord = inv.replace("/inventory_db", "/order_db")
            val mem = inv.replace("/inventory_db", "/member_db")
            val wish = inv.replace("/inventory_db", "/wishlist_db")
            // inventory (master/replica)
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.$role.jdbc-url") { inv }
                registry.add("spring.datasource.$role.username") { mysql.username }
                registry.add("spring.datasource.$role.password") { mysql.password }
                registry.add("spring.datasource.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.warehouse.$role.jdbc-url") { wh }
                registry.add("spring.datasource.warehouse.$role.username") { mysql.username }
                registry.add("spring.datasource.warehouse.$role.password") { mysql.password }
                registry.add("spring.datasource.warehouse.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.fulfillment.$role.jdbc-url") { ful }
                registry.add("spring.datasource.fulfillment.$role.username") { mysql.username }
                registry.add("spring.datasource.fulfillment.$role.password") { mysql.password }
                registry.add("spring.datasource.fulfillment.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.order.$role.jdbc-url") { ord }
                registry.add("spring.datasource.order.$role.username") { mysql.username }
                registry.add("spring.datasource.order.$role.password") { mysql.password }
                registry.add("spring.datasource.order.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.member.$role.jdbc-url") { mem }
                registry.add("spring.datasource.member.$role.username") { mysql.username }
                registry.add("spring.datasource.member.$role.password") { mysql.password }
                registry.add("spring.datasource.member.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.wishlist.$role.jdbc-url") { wish }
                registry.add("spring.datasource.wishlist.$role.username") { mysql.username }
                registry.add("spring.datasource.wishlist.$role.password") { mysql.password }
                registry.add("spring.datasource.wishlist.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
        }
    }
}
