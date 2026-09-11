package com.kgd.deal.infrastructure.persistence

import com.kgd.deal.infrastructure.config.DealDataSourceConfig
import com.kgd.deal.infrastructure.persistence.repository.DealCategoryJpaRepository
import com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository
import com.kgd.deal.infrastructure.persistence.repository.DealOfferClickJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import javax.sql.DataSource

/**
 * ADR-0093 ② — deal 전용 스키마(`deal_db`)와 JPA 엔티티가 일치하는지.
 *
 * 이 도메인은 폴드 뒤 클릭 수가 조용히 사라졌던 자리다. 그건 트랜잭션 한정자 문제였지만,
 * 같은 「조용함」이 스키마 쪽에도 있다 — 운영은 `ddl-auto=none` 이라 불일치를 검증하지 않는다.
 *
 * 컨텍스트가 뜬다 = Flyway 가 `dealdb/migration` 을 적용했고 `validate` 가 통과했다는 뜻이다.
 * Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isDealDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [DealSchemaIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=false",
        "deal.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.deal.infrastructure.persistence.DealSchemaIntegrationSpecKt#isDealDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class DealSchemaIntegrationSpec(
    @Autowired private val r0: DealCategoryJpaRepository,
    @Autowired private val r1: DealOfferJpaRepository,
    @Autowired private val r2: DealOfferClickJpaRepository,
) : BehaviorSpec({

    Given("deal 전용 Flyway 가 적용된 deal_db") {
        Then("엔티티 매핑이 마이그레이션 스키마와 일치하고 쿼리가 실행된다")
            .config(enabledIf = { dockerAvailable }) {
                // count() 는 엔티티마다 실제 SQL 을 MySQL 로 보낸다 — 컬럼이 어긋나면
                // validate 에서 컨텍스트가 아예 안 뜨고, 뜬 뒤에도 매핑이 틀리면 여기서 터진다.
                listOf(r0, r1, r2).map { it.count() }.size shouldBe 3
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    @EnableAutoConfiguration
    @Import(DealDataSourceConfig::class)
    open class Ctx {
        @Bean
        @Primary
        open fun primaryDataSource(@Qualifier("dealDataSource") ds: DataSource): DataSource = ds
    }

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("deal_db")
                .withUsername("root")
                .withPassword("test")
                .also { it.start() }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val container = mysql ?: return
            registry.add("spring.datasource.deal.url") { container.jdbcUrl }
            registry.add("spring.datasource.deal.username") { container.username }
            registry.add("spring.datasource.deal.password") { container.password }
            registry.add("spring.datasource.deal.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
