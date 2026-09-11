package com.kgd.ranking.infrastructure.persistence

import com.kgd.ranking.infrastructure.config.RankingDataSourceConfig
import com.kgd.ranking.infrastructure.persistence.repository.RankingBoardJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.RankingSnapshotJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.RankingEntryJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.GasStationJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.GasStationPriceJpaRepository
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
 * ADR-0093 ②b — ranking 전용 스키마(`ranking_db`)와 JPA 엔티티가 일치하는지.
 *
 * 이 스키마는 이번에 새로 만든 것이라 운영 데이터가 아직 없다(오피넷 키 대기). 데이터가
 * 들어오고 나서 타입이 어긋난 걸 알면 늦다 — 비어 있는 지금이 맞춰 둘 때다.
 *
 * 컨텍스트가 뜬다 = Flyway 가 `rankingdb/migration` 을 적용했고 `validate` 가 통과했다는 뜻이다.
 * Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isRankingDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [RankingSchemaIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=false",
        "ranking.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.ranking.infrastructure.persistence.RankingSchemaIntegrationSpecKt#isRankingDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class RankingSchemaIntegrationSpec(
    @Autowired private val r0: RankingBoardJpaRepository,
    @Autowired private val r1: RankingSnapshotJpaRepository,
    @Autowired private val r2: RankingEntryJpaRepository,
    @Autowired private val r3: GasStationJpaRepository,
    @Autowired private val r4: GasStationPriceJpaRepository,
) : BehaviorSpec({

    Given("ranking 전용 Flyway 가 적용된 ranking_db") {
        Then("엔티티 매핑이 마이그레이션 스키마와 일치하고 쿼리가 실행된다")
            .config(enabledIf = { dockerAvailable }) {
                // count() 는 엔티티마다 실제 SQL 을 MySQL 로 보낸다 — 컬럼이 어긋나면
                // validate 에서 컨텍스트가 아예 안 뜨고, 뜬 뒤에도 매핑이 틀리면 여기서 터진다.
                listOf(r0, r1, r2, r3, r4).map { it.count() }.size shouldBe 5
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    @EnableAutoConfiguration
    @Import(RankingDataSourceConfig::class)
    open class Ctx {
        @Bean
        @Primary
        open fun primaryDataSource(@Qualifier("rankingDataSource") ds: DataSource): DataSource = ds
    }

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("ranking_db")
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
            registry.add("spring.datasource.ranking.url") { container.jdbcUrl }
            registry.add("spring.datasource.ranking.username") { container.username }
            registry.add("spring.datasource.ranking.password") { container.password }
            registry.add("spring.datasource.ranking.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
