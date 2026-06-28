package com.kgd.inventory.infrastructure.config

import com.kgd.warehouse.infrastructure.persistence.warehouse.entity.WarehouseJpaEntity
import com.kgd.warehouse.infrastructure.persistence.warehouse.repository.WarehouseJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Import
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName

/**
 * ADR-0058 — commerce 모듈러 모놀리스의 dual-datasource(스키마 4개 유지) 와이어링 검증.
 *
 * 한 JVM(inventory:app, →commerce)에 inventory_db + warehouse_db 가 **별도 datasource/EMF/TM**
 * 로 분리 구성되는지 런타임 컨텍스트 로딩으로 확증한다:
 *  1) `inventoryEntityManagerFactory` / `warehouseEntityManagerFactory` + 각 TM 빈이 공존.
 *  2) `WarehouseJpaRepository` 가 **warehouse EMF** 에 바인딩되어 warehouse_db 에 save/find 왕복.
 *     (만약 inventory EMF 에 잘못 바인딩되면 "Not a managed type" 으로 실패 → 바인딩 정확성 보장)
 *
 * Testcontainers MySQL 단일 인스턴스에 두 스키마를 만들어 격리를 재현. ddl-auto=create 로
 * Hibernate 가 양쪽 스키마 테이블을 생성(Flyway/validate 의존 제거). Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [CommerceDualDataSourceIntegrationSpec.Ctx::class],
    properties = ["spring.main.web-application-type=none"],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.inventory.infrastructure.config.CommerceDualDataSourceIntegrationSpecKt#isDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class CommerceDualDataSourceIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
    @Autowired private val warehouseRepo: WarehouseJpaRepository,
) : BehaviorSpec({

    Given("inventory_db + warehouse_db dual-datasource 컨텍스트") {
        When("컨텍스트가 로드되면") {
            Then("inventory/warehouse 각각의 EMF·TM 빈이 공존한다")
                .config(enabledIf = { dockerAvailable }) {
                    ctx.containsBean("inventoryEntityManagerFactory").shouldBeTrue()
                    ctx.containsBean("warehouseEntityManagerFactory").shouldBeTrue()
                    ctx.containsBean("inventoryTransactionManager").shouldBeTrue()
                    ctx.containsBean("warehouseTransactionManager").shouldBeTrue()
                }
        }

        When("WarehouseJpaRepository 로 저장/조회하면") {
            Then("warehouse EMF 에 바인딩되어 warehouse_db 에 왕복된다")
                .config(enabledIf = { dockerAvailable }) {
                    val saved = warehouseRepo.save(
                        WarehouseJpaEntity(
                            name = "ICN-central",
                            address = "Incheon",
                            latitude = 37.46,
                            longitude = 126.44,
                            active = true,
                        )
                    )
                    val id = saved.id!!
                    warehouseRepo.findById(id).isPresent shouldBe true
                    warehouseRepo.findFirstByActiveTrue()?.name shouldBe "ICN-central"
                }
        }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    /** inventory + warehouse 의 실제 dual-DS 설정만 임포트해 와이어링을 좁게 검증. */
    @EnableAutoConfiguration
    @Import(DataSourceConfig::class, com.kgd.warehouse.infrastructure.config.WarehouseDataSourceConfig::class)
    open class Ctx

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
                        conn.createStatement().use { it.execute("CREATE DATABASE IF NOT EXISTS warehouse_db") }
                    }
                }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            if (mysql == null) return
            val invUrl = mysql.jdbcUrl
            val whUrl = invUrl.replace("/inventory_db", "/warehouse_db")
            // inventory datasource (master/replica 모두 동일 컨테이너 = inventory_db)
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.$role.jdbc-url") { invUrl }
                registry.add("spring.datasource.$role.username") { mysql.username }
                registry.add("spring.datasource.$role.password") { mysql.password }
                registry.add("spring.datasource.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                // warehouse datasource = warehouse_db
                registry.add("spring.datasource.warehouse.$role.jdbc-url") { whUrl }
                registry.add("spring.datasource.warehouse.$role.username") { mysql.username }
                registry.add("spring.datasource.warehouse.$role.password") { mysql.password }
                registry.add("spring.datasource.warehouse.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            // Hibernate 가 양쪽 스키마 DDL 을 생성 — Flyway/validate 의존 제거.
            registry.add("spring.jpa.hibernate.ddl-auto") { "create" }
            registry.add("spring.flyway.enabled") { "false" }
        }
    }
}
