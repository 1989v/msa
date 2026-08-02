package com.kgd.game.infrastructure.persistence

import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.infrastructure.config.GameDataSourceConfig
import com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameQueryRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameTagMapJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.data.domain.PageRequest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import javax.sql.DataSource

/**
 * ADR-0059 — game 슬라이스의 배포 전 스키마/쿼리 검증.
 *
 * 실제 MySQL 컨테이너에서 확증하는 것:
 *  1) 전용 Flyway(`classpath:gamedb/migration`)가 V1 스키마 + V2 시드를 적용한다.
 *  2) `ddl-auto=validate` 로 JPA 엔티티 매핑이 마이그레이션 스키마와 정확히 일치한다.
 *  3) Querydsl 리스트(정렬 3종·태그 필터)와 태그 교집합 유사게임 SQL 이 MySQL 에서 실행된다.
 *
 * Docker 부재 시 skip.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isGameDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [GameSchemaIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        // 호스트(Boot) Flyway 는 끄고, game 전용 Flyway 만 돌려 분리를 검증
        "spring.flyway.enabled=false",
        "game.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.game.infrastructure.persistence.GameSchemaIntegrationSpecKt#isGameDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class GameSchemaIntegrationSpec(
    @Autowired private val gameRepository: GameJpaRepository,
    @Autowired private val queryRepository: GameQueryRepository,
    @Autowired private val tagMapRepository: GameTagMapJpaRepository,
) : BehaviorSpec({

    val pageable = PageRequest.of(0, 10)

    Given("game 전용 Flyway 가 적용된 game_db") {
        When("마이그레이션이 끝나면") {
            Then("V2 내장 4종 + V3 아케이드 2종 + V7 신규 2종과 태그 매핑이 적재된다")
                .config(enabledIf = { dockerAvailable }) {
                    gameRepository.count() shouldBe 8
                    gameRepository.findBySlug("concept-memory")?.tags shouldBe
                        listOf("puzzle", "memory", "education", "casual")
                    // #23 흡수분은 정적 자산을 iframe 으로 임베드한다
                    gameRepository.findBySlug("snake")?.entryUrl shouldBe "/games/snake/index.html"
                    gameRepository.findBySlug("overworld-quest")?.loadType shouldBe LoadType.IFRAME
                    tagMapRepository.count().toInt() shouldBeGreaterThan 0
                }
        }

        When("정렬별 공개 리스트를 조회하면") {
            Then("TRENDING/NEW/TOP 쿼리가 모두 MySQL 에서 실행된다")
                .config(enabledIf = { dockerAvailable }) {
                    GameSort.entries.forEach { sort ->
                        queryRepository.search(tag = null, genre = null, sort = sort, pageable = pageable)
                            .totalElements shouldBe 8
                    }
                }
        }

        When("태그로 필터링하면") {
            Then("해당 태그를 가진 게임만 반환된다")
                .config(enabledIf = { dockerAvailable }) {
                    queryRepository.search(tag = "memory", genre = null, sort = GameSort.TRENDING, pageable = pageable)
                        .content.map { it.slug } shouldBe listOf("concept-memory")
                    queryRepository.search(tag = "education", genre = null, sort = GameSort.TRENDING, pageable = pageable)
                        .totalElements shouldBe 4
                }
        }

        When("유사 게임을 조회하면") {
            Then("태그를 공유하는 다른 게임만 반환된다 (자기 자신 제외)")
                .config(enabledIf = { dockerAvailable }) {
                    val target = gameRepository.findBySlug("concept-memory")!!
                    val similar = queryRepository.findSimilar(target.id!!, limit = 8)

                    similar.size shouldBeGreaterThan 0
                    similar.map { it.slug } shouldNotContain "concept-memory"
                }
        }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    /**
     * game 슬라이스만 좁게 로드. 호스트(code-dictionary:app)가 제공하는 `@Primary` DataSource 를
     * 테스트에서 대신 제공해 Boot 의 EntityManagerFactoryBuilder 를 구성한다.
     */
    @EnableAutoConfiguration
    @Import(GameDataSourceConfig::class, GameQueryRepository::class)
    open class Ctx {
        @Bean
        @Primary
        open fun primaryDataSource(@Qualifier("gameDataSource") gameDataSource: DataSource): DataSource =
            gameDataSource
    }

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("game_db")
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
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.game.$role.jdbc-url") { container.jdbcUrl }
                registry.add("spring.datasource.game.$role.username") { container.username }
                registry.add("spring.datasource.game.$role.password") { container.password }
                registry.add("spring.datasource.game.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
        }
    }
}
