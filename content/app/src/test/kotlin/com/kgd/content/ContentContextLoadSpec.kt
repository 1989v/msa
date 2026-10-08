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
    @Autowired @Qualifier("blogDataSource") private val blogDs: DataSource,
) : BehaviorSpec({

    Given("content 모듈러 모놀리스 (place + game + ranking + blog 한 JVM)") {
        Then("네 도메인의 EMF/TM 과 전용 Flyway 가 충돌 없이 로드된다") {
            listOf(
                "placeEntityManagerFactory", "placeTransactionManager", "placeFlyway",
                "gameEntityManagerFactory", "gameTransactionManager", "gameFlyway",
                "gameJpaQueryFactory",
                "rankingEntityManagerFactory", "rankingTransactionManager", "rankingFlyway",
                "blogEntityManagerFactory", "blogTransactionManager", "blogFlyway",
            ).forEach { ctx.containsBean(it).shouldBeTrue() }
        }

        Then("primary 는 place 다 — 없으면 타입 주입이 깨진다") {
            (primaryDs === placeDs) shouldBe true
            (placeDs === gameDs) shouldBe false
        }

        // 이름이 아니라 **연결이 실제로 어디로 가는지**를 본다. 빈 존재만 세면
        // 자동 구성 back-off 로 JPA 가 죽은 상태도 통과한다.
        Then("네 datasource 가 서로 다른 스키마를 본다") {
            fun schemaOf(ds: DataSource) = ds.connection.use { it.catalog }
            schemaOf(placeDs) shouldBe "place_db"
            schemaOf(gameDs) shouldBe "game_db"
            schemaOf(rankingDs) shouldBe "ranking_db"
            schemaOf(blogDs) shouldBe "blog_db"
        }

        // 설정 파일이 아니라 떠 있는 HikariDataSource 의 값을 읽는다. 풀 키가 바인딩되지 않는
        // 경로에 있으면 설정은 5 인데 풀은 기본값(최대 10 · 유휴 최소 10)으로 뜬다.
        Then("MySQL 풀은 place 최대 3, 나머지 최대 5, 전부 유휴 최소 1 이다") {
            val pools = ctx.getBeansOfType(com.zaxxer.hikari.HikariDataSource::class.java)
                .filterValues { it.jdbcUrl.startsWith("jdbc:mysql:") }
            pools.mapValues { it.value.maximumPoolSize to it.value.minimumIdle } shouldBe mapOf(
                "placeDataSource" to (3 to 1),
                "gameMasterDataSource" to (5 to 1), "gameReplicaDataSource" to (5 to 1),
                "rankingDataSource" to (5 to 1), "blogDataSource" to (5 to 1),
            )
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
                com.kgd.blog.presentation.controller.BlogPublicController::class.java,
                com.kgd.blog.presentation.controller.BlogPageController::class.java,
                // 단축 주소 해석(ADR-0103) — 빠지면 /g·/b·/p 가 배포 뒤에야 404 로 드러난다
                com.kgd.game.presentation.shortlink.controller.GameShortLinkController::class.java,
                com.kgd.blog.presentation.controller.BlogShortLinkController::class.java,
                com.kgd.place.presentation.shortlink.controller.AttractionShortLinkController::class.java,
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

        // 컨텍스트가 뜨는 것은 배선만 증명한다. 한정자가 빠진 @Transactional 은 호스트의
        // primary TM(place)에 붙어 쓰기만 조용히 사라지므로, 값이 실제로 변하는지 봐야 한다.
        Then("blog 조회수가 실제로 증가한다 — 한정자 없는 @Transactional 이면 조용히 실패한다") {
            val posts = ctx.getBean(
                com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository::class.java,
            )
            val saved = posts.save(
                com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity(
                    slug = "tm-qualifier-probe",
                    title = "probe",
                ),
            )
            val id = requireNotNull(saved.id)
            val was = posts.findById(id).orElseThrow().viewCount

            ctx.getBean(com.kgd.blog.application.interaction.usecase.RecordBlogViewUseCase::class.java)
                .execute(
                    com.kgd.blog.application.interaction.usecase.RecordBlogViewUseCase.Command(
                        postId = id, visitorKey = "probe-visitor", userAgent = "Mozilla/5.0",
                    ),
                )

            posts.findById(id).orElseThrow().viewCount shouldBe was + 1
        }

        // 단축 주소 클릭은 도메인 TM 한정자 + REQUIRES_NEW 로 쓴다. 한정자가 빠지면 primary(place) TM 에
        // 붙어 game·blog 쓰기가 실패하거나 사라진다. 누적 수는 각 도메인 DB 를 JDBC 로 직접 읽어 판정한다.
        fun clickCount(ds: DataSource, table: String, idColumn: String, id: Long): Long =
            ds.connection.use { conn ->
                conn.prepareStatement("SELECT click_count FROM $table WHERE $idColumn = ?").use { st ->
                    st.setLong(1, id)
                    st.executeQuery().use { rs -> if (rs.next()) rs.getLong(1) else 0L }
                }
            }

        val probeUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/129.0.0.0 Safari/537.36"

        Then("game 단축 주소 클릭이 game_db 의 누적 수를 1 올린다") {
            val gameId = 910_001L
            val was = clickCount(gameDs, "game_short_link_stat", "game_id", gameId)

            ctx.getBean(com.kgd.game.application.shortlink.usecase.RecordGameShortLinkClickUseCase::class.java)
                .execute(
                    com.kgd.game.application.shortlink.usecase.RecordGameShortLinkClickUseCase.Command(
                        gameId = gameId, referrer = "https://open.kakao.com/o/x", userAgent = probeUa,
                    ),
                )

            clickCount(gameDs, "game_short_link_stat", "game_id", gameId) shouldBe was + 1
        }

        Then("blog 단축 주소 클릭이 blog_db 의 누적 수를 1 올린다") {
            val postId = 910_002L
            val was = clickCount(blogDs, "blog_short_link_stat", "post_id", postId)

            ctx.getBean(com.kgd.blog.application.shortlink.usecase.RecordBlogShortLinkClickUseCase::class.java)
                .execute(
                    com.kgd.blog.application.shortlink.usecase.RecordBlogShortLinkClickUseCase.Command(
                        postId = postId, referrer = null, userAgent = probeUa,
                    ),
                )

            clickCount(blogDs, "blog_short_link_stat", "post_id", postId) shouldBe was + 1
        }

        Then("place 단축 주소 클릭이 place_db 의 누적 수를 1 올린다") {
            val attractionId = 910_003L
            val was = clickCount(placeDs, "attraction_short_link_stat", "attraction_id", attractionId)

            ctx.getBean(com.kgd.place.application.shortlink.usecase.RecordAttractionShortLinkClickUseCase::class.java)
                .execute(
                    com.kgd.place.application.shortlink.usecase.RecordAttractionShortLinkClickUseCase.Command(
                        attractionId = attractionId, referrer = null, userAgent = probeUa,
                    ),
                )

            clickCount(placeDs, "attraction_short_link_stat", "attraction_id", attractionId) shouldBe was + 1
        }

        Then("place 클릭 원장 정리는 90일 넘은 행만 지우고 누적 수는 남긴다") {
            val attractionId = 910_004L
            placeDs.connection.use { conn ->
                conn.createStatement().use {
                    it.execute(
                        "INSERT INTO attraction_short_link_click (attraction_id, clicked_at, ua_family) VALUES " +
                            "($attractionId, NOW(3) - INTERVAL 91 DAY, 'desktop'), ($attractionId, NOW(3), 'desktop')",
                    )
                    it.execute(
                        "INSERT INTO attraction_short_link_stat (attraction_id, click_count) VALUES ($attractionId, 2)",
                    )
                }
            }
            fun ledgerRows() = placeDs.connection.use { conn ->
                conn.createStatement().use { st ->
                    st.executeQuery(
                        "SELECT COUNT(*) FROM attraction_short_link_click WHERE attraction_id = $attractionId",
                    ).use { rs -> rs.next(); rs.getLong(1) }
                }
            }

            ctx.getBean(com.kgd.place.application.shortlink.usecase.PurgeAttractionShortLinkClicksUseCase::class.java)
                .olderThan(90L)

            ledgerRows() shouldBe 1L
            clickCount(placeDs, "attraction_short_link_stat", "attraction_id", attractionId) shouldBe 2L
        }

        Then("game 평점 집계가 실제로 반영된다 — 두 리포지토리 쓰기가 한 트랜잭션이어야 한다") {
            val stats = ctx.getBean(
                com.kgd.game.infrastructure.persistence.catalog.repository.GameStatsJpaRepository::class.java,
            )
            val games = ctx.getBean(
                com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository::class.java,
            )
            val gameId = requireNotNull(games.findBySlug("snake")?.id)
            val before = stats.findById(gameId).orElse(null)?.ratingCount ?: 0

            ctx.getBean(com.kgd.game.application.play.usecase.RateGameUseCase::class.java)
                .execute(
                    com.kgd.game.application.play.usecase.RateGameUseCase.Command(
                        slug = "snake", memberId = null, deviceId = "tm-qualifier-probe", score = 5,
                    ),
                )

            stats.findById(gameId).orElseThrow().ratingCount shouldBe before + 1
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
                            it.execute("CREATE DATABASE IF NOT EXISTS blog_db")
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
            val blogUrl = placeUrl.replace("/place_db", "/blog_db")
            registry.add("spring.datasource.place.url") { placeUrl }
            registry.add("spring.datasource.place.username") { c.username }
            registry.add("spring.datasource.place.password") { c.password }
            registry.add("spring.datasource.place.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            registry.add("spring.datasource.blog.url") { blogUrl }
            registry.add("spring.datasource.blog.username") { c.username }
            registry.add("spring.datasource.blog.password") { c.password }
            registry.add("spring.datasource.blog.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
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
