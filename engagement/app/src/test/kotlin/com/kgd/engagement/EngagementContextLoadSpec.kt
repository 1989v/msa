package com.kgd.engagement

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.ApplicationContext
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import javax.sql.DataSource

/**
 * ADR-0093 — engagement 모듈러 모놀리스 **전체 컨텍스트 로드** 검증.
 *
 * `./gradlew build` 와 단위 테스트는 전부 통과하면서 폴드 결함이 살아 있을 수 있다.
 * 실제 `@SpringBootApplication` 을 띄우는 이 검사가 유일한 방어선이다.
 *
 * 특히 보는 것: **recommendation 의 `clickHouseDataSource` 가 experiment 의 JPA 를 죽이지 않는가.**
 * Spring Boot 의 `DataSourceAutoConfiguration` 은 `@ConditionalOnMissingBean(DataSource)` 이라
 * 그 빈 하나로 back-off 하고, 그러면 MySQL 연결과 리포지토리가 조용히 사라진다.
 * `ExperimentDataSourceConfig` 가 명시로 만들기 때문에 뜨는 것이고, 그 설정을 지우면 이 검사가 죽는다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun engagementDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [EngagementApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "spring.kafka.bootstrap-servers=localhost:9092",
        // ClickHouse 는 이 검사에 없다. ClickHouseConfig 가 initializationFailTimeout=-1 로
        // 기동 때 연결을 열지 않기 때문에 뜬다 — 그 설정을 되돌리면 이 검사가 죽는다.
        "recommendation.clickhouse.url=jdbc:clickhouse://localhost:8123/analytics",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.engagement.EngagementContextLoadSpecKt#engagementDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class EngagementContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
    @Autowired @Qualifier("experimentDataSource") private val experimentDs: DataSource,
    @Autowired @Qualifier("clickHouseDataSource") private val clickHouseDs: DataSource,
) : BehaviorSpec({

    Given("engagement 모듈러 모놀리스 (recommendation + experiment 한 JVM)") {
        Then("두 도메인의 빈이 충돌 없이 함께 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "experimentDataSource",
                    "experimentEntityManagerFactory",
                    "experimentTransactionManager",
                    "clickHouseDataSource",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
            }

        // 이름이 아니라 **연결이 실제로 어디로 가는지**를 본다. 빈 존재만 세면
        // 자동 구성 back-off 로 JPA 가 죽은 상태도 통과한다.
        Then("experiment 의 datasource 가 MySQL 이고 ClickHouse 와 다른 연결이다")
            .config(enabledIf = { dockerAvailable }) {
                experimentDs.connection.use { c ->
                    c.metaData.databaseProductName.lowercase().contains("mysql") shouldBe true
                }
                (experimentDs === clickHouseDs) shouldBe false
            }

        Then("experiment 리포지토리가 그 datasource 로 실제 질의를 한다")
            .config(enabledIf = { dockerAvailable }) {
                // 리포지토리 빈이 EMF 에 바인딩돼 동작하는지 — count() 가 돌면 스키마까지 닿은 것이다
                val repo = ctx.getBean(com.kgd.experiment.infrastructure.persistence.ExperimentJpaRepository::class.java)
                (repo.count() >= 0L) shouldBe true
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("experiment_db")
                .withUsername("root")
                .withPassword("test")
                .also { it.start() }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val c = mysql ?: return
            registry.add("spring.datasource.url") { c.jdbcUrl }
            registry.add("spring.datasource.username") { c.username }
            registry.add("spring.datasource.password") { c.password }
            registry.add("spring.datasource.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
