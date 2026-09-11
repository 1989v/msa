package com.kgd.place.infrastructure.persistence

import com.kgd.place.infrastructure.config.PlaceDataSourceConfig
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionCategoryCodeJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionJpaRepository
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionLinkJpaRepository
import com.kgd.place.infrastructure.persistence.poi.repository.PoiJpaRepository
import com.kgd.place.infrastructure.persistence.region.repository.AdminRegionJpaRepository
import com.kgd.place.infrastructure.persistence.region.repository.RegionJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName

/**
 * ADR-0093 ① — place 전용 스키마(`place_db`)와 JPA 엔티티가 일치하는지.
 *
 * **실제로 여기서 잡혔어야 할 것이 폴드할 때 처음 드러났다** — `attraction_category_codes.depth`
 * 가 TINYINT 인데 엔티티는 `Int` 였다. 운영은 `ddl-auto=none` 이라 몇 달 동안 조용했다.
 *
 * 컨텍스트가 뜬다 = Flyway 가 `placedb/migration` 을 적용했고 `validate` 가 통과했다는 뜻이다.
 * Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isPlaceDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [PlaceSchemaIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        "spring.flyway.enabled=false",
        "place.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.place.infrastructure.persistence.PlaceSchemaIntegrationSpecKt#isPlaceDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class PlaceSchemaIntegrationSpec(
    @Autowired private val r0: RegionJpaRepository,
    @Autowired private val r1: AdminRegionJpaRepository,
    @Autowired private val r2: PoiJpaRepository,
    @Autowired private val r3: AttractionJpaRepository,
    @Autowired private val r4: AttractionCategoryCodeJpaRepository,
    @Autowired private val r5: AttractionLinkJpaRepository,
) : BehaviorSpec({

    Given("place 전용 Flyway 가 적용된 place_db") {
        Then("엔티티 매핑이 마이그레이션 스키마와 일치하고 쿼리가 실행된다")
            .config(enabledIf = { dockerAvailable }) {
                // count() 는 엔티티마다 실제 SQL 을 MySQL 로 보낸다 — 컬럼이 어긋나면
                // validate 에서 컨텍스트가 아예 안 뜨고, 뜬 뒤에도 매핑이 틀리면 여기서 터진다.
                listOf(r0, r1, r2, r3, r4, r5).map { it.count() }.size shouldBe 6
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    /**
     * place 는 자기 config 가 이미 `@Primary` 를 붙인다 — 여기서 별칭을 하나 더 만들면
     * `@Primary` DataSource 가 둘이 되어 `JpaBaseConfiguration`(`@ConditionalOnSingleCandidate`)
     * 이 물러나고 `EntityManagerFactoryBuilder` 가 아예 안 생긴다. 다른 도메인 스펙과
     * 이 한 줄이 다른 이유다.
     */
    @EnableAutoConfiguration
    @Import(PlaceDataSourceConfig::class)
    open class Ctx

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("place_db")
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
            registry.add("spring.datasource.place.url") { container.jdbcUrl }
            registry.add("spring.datasource.place.username") { container.username }
            registry.add("spring.datasource.place.password") { container.password }
            registry.add("spring.datasource.place.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
