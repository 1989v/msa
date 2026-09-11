package com.kgd.inventory

import com.kgd.commerce.CommerceApplication
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
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
 * inventory + warehouse + fulfillment + order + product 도메인 feature 를 한 JVM(InventoryApplication→commerce)에
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
        // product 는 전용 Flyway 를 갖는다 — 호스트 토글로는 안 꺼진다.
        "product.flyway.enabled=false",
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

    Given("commerce 모듈러 모놀리스 (inventory + warehouse + fulfillment + order + product + deal 한 JVM)") {
        Then("3 도메인 EMF/TM + 전용 outbox/idempotency 가 충돌 없이 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                // 3 persistence units (도메인별 datasource 격리)
                listOf(
                    "inventoryEntityManagerFactory", "inventoryTransactionManager",
                    "warehouseEntityManagerFactory", "warehouseTransactionManager",
                    "fulfillmentEntityManagerFactory", "fulfillmentTransactionManager",
                    "orderEntityManagerFactory", "orderTransactionManager",
                    // ADR-0093 — product 폴드. 독립 앱 시절 총칭 이름(dataSource·jpaQueryFactory)이
                    // inventory 것과 정면 충돌해 컨텍스트가 안 떴다 — 전부 product* 로 스코프했다.
                    "productEntityManagerFactory", "productTransactionManager",
                    "productJpaQueryFactory",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }

                // 도메인별 전용 outbox/idempotency (각자 TM 바인딩)
                ctx.containsBean("fulfillmentOutboxPort").shouldBeTrue()
                ctx.containsBean("fulfillmentOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("fulfillmentIdempotentEventHandler").shouldBeTrue()
                ctx.containsBean("orderOutboxPort").shouldBeTrue()
                ctx.containsBean("orderOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("orderIdempotentEventHandler").shouldBeTrue()
                ctx.containsBean("inventoryOutboxPort").shouldBeTrue()
                ctx.containsBean("inventoryOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("inventoryIdempotentEventHandler").shouldBeTrue()
                // 도메인별 retention cleanup 스케줄러 (common 단일 스케줄러의 다중-port 모호성 회피)
                ctx.containsBean("inventoryIdempotentEventCleanupScheduler").shouldBeTrue()
                ctx.containsBean("fulfillmentIdempotentEventCleanupScheduler").shouldBeTrue()
                ctx.containsBean("orderIdempotentEventCleanupScheduler").shouldBeTrue()

                // ADR-0093 ② — deal 전용 스키마(deal_db). 조건부 설정이라 키가 없으면
                // 통째로 안 켜지고 리포지토리가 호스트 EMF 로 붙는다 — 그 상태를 잡는다.
                listOf(
                    "dealDataSource", "dealEntityManagerFactory",
                    "dealTransactionManager", "dealFlyway",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
            }

        /**
         * ADR-0058 불변식 — 폴드된 도메인의 `@Transactional` 은 **자기 TM 을 한정자로 지정**해야 한다.
         *
         * 빈 존재만 세면 이 결함을 못 잡는다. 한정자가 없으면 primary(inventory) TM 에 붙고,
         * deal EM 이 트랜잭션에 참여하지 않아 `@Modifying` UPDATE 가 조용히 실패한다.
         * 그리고 `RecordDealClickUseCase` 의 호출부는 그 실패를 **의도적으로 삼킨다**(리다이렉트가
         * 본질이라서) — 그래서 로그에도 안 남고 클릭 수만 안 오른다.
         *
         * 2026-09-11 운영에서 실제로 그랬다: 클릭 행은 40→42 로 늘고 click_count 는 8 고정.
         * 그래서 **값으로 판정한다** — 실제로 한 번 올려 보고 1 이 늘었는지 읽는다.
         */
        Then("deal 클릭 수가 실제로 증가한다 — 한정자 없는 @Transactional 이면 조용히 실패한다")
            .config(enabledIf = { dockerAvailable }) {
                val offers = ctx.getBean(
                    com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository::class.java,
                )
                // V1 은 카테고리만 시드한다 — 오퍼는 이 검사가 직접 만든다(자기 완결).
                val saved = offers.save(
                    com.kgd.deal.infrastructure.persistence.entity.DealOfferJpaEntity(
                        slug = "tm-qualifier-probe",
                        categoryId = 1,
                        merchant = "probe",
                        title = "probe",
                        benefit = "probe",
                        targetUrl = "https://example.invalid/probe",
                    ),
                )
                val id = requireNotNull(saved.id)
                val was = offers.findById(id).orElseThrow().clickCount

                ctx.getBean(com.kgd.deal.application.offer.usecase.RecordDealClickUseCase::class.java)
                    .execute(
                        com.kgd.deal.application.offer.usecase.RecordDealClickUseCase.Command(
                            offerId = id, referrer = null, userAgent = null,
                        ),
                    )

                offers.findById(id).orElseThrow().clickCount shouldBe was + 1
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
                            it.execute("CREATE DATABASE IF NOT EXISTS product_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS deal_db")
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
            val prod = inv.replace("/inventory_db", "/product_db")
            val deal = inv.replace("/inventory_db", "/deal_db")
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
                registry.add("spring.datasource.product.$role.jdbc-url") { prod }
                registry.add("spring.datasource.product.$role.username") { mysql.username }
                registry.add("spring.datasource.product.$role.password") { mysql.password }
                registry.add("spring.datasource.product.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            // deal 은 master/replica 가 아니라 단일 url 이다 — 읽기 복제본이 없다.
            // 이 키가 있어야 DealDataSourceConfig(@ConditionalOnProperty)가 켜진다.
            registry.add("spring.datasource.deal.url") { deal }
            registry.add("spring.datasource.deal.username") { mysql.username }
            registry.add("spring.datasource.deal.password") { mysql.password }
            registry.add("spring.datasource.deal.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
