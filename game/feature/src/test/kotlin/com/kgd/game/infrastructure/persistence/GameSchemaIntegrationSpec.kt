package com.kgd.game.infrastructure.persistence

import com.kgd.game.application.catalog.port.GameSearchCriteria
import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.infrastructure.config.GameDataSourceConfig
import com.kgd.game.infrastructure.persistence.catalog.entity.GameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameQueryRepository
import com.kgd.game.infrastructure.persistence.catalog.repository.GameTagMapJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContain
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

private const val DRAFT_SLUG = "zz-admin-draft-fixture"

/** 시드는 전부 PUBLISHED 라 상태 무관 조회를 확증하려면 비공개 상태 행을 직접 하나 심어야 한다 */
private fun draftFixture() = GameJpaEntity(
    slug = DRAFT_SLUG,
    title = "어드민 초안 픽스처",
    description = "상태 무관 조회 검증용",
    titleEn = "Admin Draft Fixture",
    descriptionEn = null,
    thumbnailUrl = "/thumbs/draft.png",
    coverUrl = null,
    engineType = EngineType.HTML5,
    loadType = LoadType.IFRAME,
    entryUrl = "/games/$DRAFT_SLUG/index.html",
    orientation = Orientation.BOTH,
    supportsMobile = true,
    developerName = "kgd",
    sdkIntegrated = false,
    status = GameStatus.DRAFT,
    genre = Genre.STRATEGY,
    releasedAt = null,
    contentUpdatedAt = null,
)

private fun publicCriteria(tag: String? = null, sort: GameSort = GameSort.TRENDING) =
    GameSearchCriteria(tag = tag, statuses = setOf(GameStatus.PUBLISHED), sort = sort)

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
            Then("초기 시드(V2 내장 4종 + V3 아케이드 2종 + V7 신규 2종)와 태그 매핑이 적재된다")
                .config(enabledIf = { dockerAvailable }) {
                    // 시드는 마이그레이션마다 늘어난다 — 최초 시드 8종을 하한으로 검증
                    (gameRepository.count() >= 8) shouldBe true
                    gameRepository.findBySlug("concept-memory")?.tags shouldBe
                        listOf("puzzle", "memory", "education", "casual")
                    // #23 흡수분은 정적 자산을 iframe 으로 임베드한다
                    gameRepository.findBySlug("snake")?.entryUrl shouldBe "/games/snake/index.html"
                    gameRepository.findBySlug("overworld-quest")?.loadType shouldBe LoadType.IFRAME
                    tagMapRepository.count().toInt() shouldBeGreaterThan 0
                }
        }

        When("정렬별 공개 리스트를 조회하면") {
            Then("공개/어드민 정렬 쿼리가 모두 MySQL 에서 실행된다")
                .config(enabledIf = { dockerAvailable }) {
                    GameSort.entries.forEach { sort ->
                        (queryRepository.search(publicCriteria(sort = sort), pageable).totalElements >= 8) shouldBe true
                    }
                }
        }

        When("태그로 필터링하면") {
            Then("해당 태그를 가진 게임만 반환된다")
                .config(enabledIf = { dockerAvailable }) {
                    // V25 에서 태그를 플레이 속성 축으로 정리 — 'memory' 같은 파편 태그는 제거됐다.
                    queryRepository.search(publicCriteria(tag = "open-world"), pageable)
                        .content.map { it.slug } shouldBe listOf("drift-continent")
                    // 정확 개수 대신 하한 — 시드 팩이 늘 때마다 깨지는 단언을 피한다
                    (queryRepository.search(publicCriteria(tag = "education"), pageable)
                        .totalElements >= 4) shouldBe true
                }
        }

        When("어드민이 상태 무관으로 조회하면") {
            Then("공개 목록에 없는 DRAFT 도 보이고, 공개 목록은 그대로 PUBLISHED 만 남는다")
                .config(enabledIf = { dockerAvailable }) {
                    val draft = gameRepository.save(draftFixture())
                    try {
                        val adminSlugs = queryRepository
                            .search(GameSearchCriteria(sort = GameSort.UPDATED), PageRequest.of(0, 200))
                            .content.map { it.slug }
                        adminSlugs shouldContain DRAFT_SLUG

                        val publicSlugs = queryRepository
                            .search(publicCriteria(sort = GameSort.UPDATED), PageRequest.of(0, 200))
                            .content.map { it.slug }
                        publicSlugs shouldNotContain DRAFT_SLUG
                    } finally {
                        gameRepository.delete(draft)
                    }
                }

            Then("검색어·상태·장르 필터와 페이징·정렬이 각각 동작한다")
                .config(enabledIf = { dockerAvailable }) {
                    val draft = gameRepository.save(draftFixture())
                    try {
                        // 검색어 — 슬러그/제목 부분일치
                        queryRepository.search(GameSearchCriteria(q = "admin-draft"), pageable)
                            .content.map { it.slug } shouldBe listOf(DRAFT_SLUG)
                        queryRepository.search(GameSearchCriteria(q = "픽스처"), pageable)
                            .content.map { it.slug } shouldBe listOf(DRAFT_SLUG)

                        // 상태 필터
                        queryRepository.search(GameSearchCriteria(statuses = setOf(GameStatus.DRAFT)), pageable)
                            .content.map { it.slug } shouldBe listOf(DRAFT_SLUG)

                        // 장르 필터
                        val strategy = queryRepository
                            .search(GameSearchCriteria(genre = Genre.STRATEGY), PageRequest.of(0, 200)).content
                        strategy.map { it.genre }.toSet() shouldBe setOf(Genre.STRATEGY)
                        strategy.map { it.slug } shouldContain DRAFT_SLUG

                        // 페이징 — 같은 정렬에서 1페이지와 2페이지가 겹치지 않는다
                        val first = queryRepository.search(GameSearchCriteria(sort = GameSort.TITLE), PageRequest.of(0, 5))
                        val second = queryRepository.search(GameSearchCriteria(sort = GameSort.TITLE), PageRequest.of(1, 5))
                        first.content.size shouldBe 5
                        first.content.map { it.slug }.intersect(second.content.map { it.slug }.toSet()) shouldBe emptySet()

                        // 정렬 — created/updated 는 내림차순 (제목 정렬은 DB collation 소관이라 실행만 확인)
                        val created = queryRepository
                            .search(GameSearchCriteria(sort = GameSort.CREATED), PageRequest.of(0, 200)).content
                            .map { it.createdAt }
                        created shouldBe created.sortedDescending()
                        val updated = queryRepository
                            .search(GameSearchCriteria(sort = GameSort.UPDATED), PageRequest.of(0, 200)).content
                            .map { it.updatedAt }
                        updated shouldBe updated.sortedDescending()
                    } finally {
                        gameRepository.delete(draft)
                    }
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
