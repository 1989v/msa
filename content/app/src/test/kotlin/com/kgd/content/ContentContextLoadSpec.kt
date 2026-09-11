package com.kgd.content

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.nulls.shouldNotBeNull
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
 * ADR-0093 — content 모듈러 모놀리스(place + game) **전체 컨텍스트 로드** 검증.
 *
 * 이 폴드가 깨뜨리는 것은 하나다. place 는 독립 앱일 때 datasource 를 **자동 구성에 맡기고**
 * 있었고, game 은 `gameDataSource` 를 직접 만든다. 둘을 한 JVM 에 올리면
 * `DataSourceAutoConfiguration`(@ConditionalOnMissingBean) 이 game 의 빈 하나로 back-off 해
 * **place 의 JPA 가 조용히 사라진다** — 컴파일도 단위 테스트도 통과한 채로.
 *
 * 그래서 빈 이름만 세지 않는다. 두 datasource 를 **연결해서** 서로 다른 스키마를 보는지,
 * 타입 주입(primary)이 place 로 가는지, game 마이그레이션이 game_db 에만 적용됐는지를 본다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun contentDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [ContentApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.kafka.bootstrap-servers=localhost:9092",
        "spring.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "opensearch.uris=http://localhost:9200",
        // 아케이드 세션 토큰 서명 키 — 없으면 컨텍스트가 뜨지 않는다 (ADR-0092).
        // 32바이트 하한만 넘기면 되고, 값 자체는 이 테스트의 판정 대상이 아니다.
        "game.security.hmac-secret=test-key-for-context-load-only-32b",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.content.ContentContextLoadSpecKt#contentDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class ContentContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
    /** 타입으로 받는다 — primary 가 없거나 둘이면 여기서 주입이 깨진다 */
    @Autowired private val primaryDs: DataSource,
    @Autowired @Qualifier("placeDataSource") private val placeDs: DataSource,
    @Autowired @Qualifier("gameDataSource") private val gameDs: DataSource,
    @Autowired @Qualifier("rankingDataSource") private val rankingDs: DataSource,
) : BehaviorSpec({

    Given("content 모듈러 모놀리스 (place + game + ranking 한 JVM)") {
        Then("세 도메인의 EMF/TM 과 전용 Flyway 가 충돌 없이 로드된다") {
            listOf(
                "placeEntityManagerFactory", "placeTransactionManager", "placeFlyway",
                "gameEntityManagerFactory", "gameTransactionManager", "gameFlyway",
                "gameJpaQueryFactory",
                "rankingEntityManagerFactory", "rankingTransactionManager", "rankingFlyway",
            ).forEach { ctx.containsBean(it).shouldBeTrue() }
        }

        Then("primary 는 place 다 — 없으면 타입 주입이 깨진다") {
            (primaryDs === placeDs) shouldBe true
            (placeDs === gameDs) shouldBe false
        }

        // 이름이 아니라 **연결이 실제로 어디로 가는지**를 본다. 빈 존재만 세면
        // 자동 구성 back-off 로 JPA 가 죽은 상태도 통과한다.
        Then("세 datasource 가 서로 다른 스키마를 본다") {
            fun schemaOf(ds: DataSource) = ds.connection.use { it.catalog }
            schemaOf(placeDs) shouldBe "place_db"
            schemaOf(gameDs) shouldBe "game_db"
            schemaOf(rankingDs) shouldBe "ranking_db"
        }

        Then("두 도메인의 컨트롤러가 전부 빈으로 등록된다") {
            // scanBasePackages 에서 패키지를 빠뜨리면 컨텍스트는 멀쩡히 뜨고 Flyway 도 돌지만
            // 그 도메인의 API 만 조용히 404 가 된다 — 기동 실패가 아니라 배포 후에야 드러난다.
            listOf(
                com.kgd.game.presentation.suggestion.controller.GameSuggestionController::class.java,
                com.kgd.game.presentation.roster.controller.RosterController::class.java,
                com.kgd.game.presentation.party.controller.PartyController::class.java,
                com.kgd.place.presentation.attraction.controller.AttractionController::class.java,
                com.kgd.ranking.presentation.controller.RankingController::class.java,
            ).forEach { ctx.getBeanNamesForType(it).size shouldBe 1 }
        }

        Then("각 마이그레이션이 자기 스키마에만 적용된다") {
            val gameRepository = ctx.getBean(
                com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository::class.java,
            )
            // 시드는 마이그레이션이 늘 때마다 증가한다 — 최초 시드(V2+V3, 6종)를 하한으로.
            (gameRepository.count() >= 6).shouldBeTrue()
            gameRepository.findBySlug("overworld-quest").shouldNotBeNull()
        }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("place_db")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use {
                            it.execute("CREATE DATABASE IF NOT EXISTS game_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS ranking_db")
                        }
                    }
                }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val c = mysql ?: return
            val placeUrl = c.jdbcUrl
            val gameUrl = placeUrl.replace("/place_db", "/game_db")
            val rankingUrl = placeUrl.replace("/place_db", "/ranking_db")
            registry.add("spring.datasource.place.url") { placeUrl }
            registry.add("spring.datasource.place.username") { c.username }
            registry.add("spring.datasource.place.password") { c.password }
            registry.add("spring.datasource.place.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            registry.add("spring.datasource.ranking.url") { rankingUrl }
            registry.add("spring.datasource.ranking.username") { c.username }
            registry.add("spring.datasource.ranking.password") { c.password }
            registry.add("spring.datasource.ranking.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.game.$role.jdbc-url") { gameUrl }
                registry.add("spring.datasource.game.$role.username") { c.username }
                registry.add("spring.datasource.game.$role.password") { c.password }
                registry.add("spring.datasource.game.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
        }
    }
}
