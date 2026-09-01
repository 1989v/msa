package com.kgd.codedictionary

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationContext
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName

/**
 * ADR-0059 — code-dictionary + game 폴드의 **전체 컨텍스트 로드** 검증.
 *
 * 두 바운디드 컨텍스트가 한 JVM 에 스캔되므로 ① 빈 이름 충돌이 없고 ② 기본(code_dictionary)과
 * game 의 EMF/TM 이 공존하며 ③ 두 Flyway(`db/migration` / `gamedb/migration`)가 각자 스키마에만
 * 적용되는지 확인한다. Spring 은 기본적으로 빈 오버라이드를 막으므로, 컨텍스트가 뜬다는 것 자체가
 * 충돌 부재의 증거다 (배포 시 파드 기동 실패를 사전 차단).
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun codeDictionaryDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [CodeDictionaryApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.bootstrap-servers=localhost:9092",
        "opensearch.uris=http://localhost:9200",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.codedictionary.CodeDictionaryContextLoadSpecKt#codeDictionaryDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class CodeDictionaryContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec({

    Given("code-dictionary + game 이 한 JVM 에 폴드된 컨텍스트") {
        Then("두 도메인의 EMF/TM 과 game 전용 Flyway·QueryFactory 가 충돌 없이 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "entityManagerFactory", "transactionManager",
                    "gameEntityManagerFactory", "gameTransactionManager",
                    "gameFlyway", "gameJpaQueryFactory", "jpaQueryFactory",
                    "gameKafkaTemplate",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
            }

        /**
         * 폴드된 도메인의 **컨트롤러가 실제로 매핑되는지** 본다.
         *
         * scanBasePackages 에서 패키지를 빠뜨리면 컨텍스트는 멀쩡히 뜨고 Flyway 도 돌지만
         * 그 도메인의 API 만 조용히 404 가 된다 — 기동 실패가 아니라서 배포 후에야 드러난다
         * (ADR-0072 blog 폴드 때 실제로 겪었다). 새 도메인을 폴드하면 여기 한 줄을 더한다.
         */
        Then("폴드된 도메인(game·deal·blog)의 컨트롤러가 전부 빈으로 등록된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    com.kgd.deal.presentation.controller.DealController::class.java,
                    com.kgd.blog.presentation.controller.BlogPublicController::class.java,
                    com.kgd.blog.presentation.controller.BlogStudioController::class.java,
                    com.kgd.blog.presentation.controller.BlogAdminController::class.java,
                    com.kgd.blog.presentation.controller.BlogPageController::class.java,
                    com.kgd.game.presentation.suggestion.controller.GameSuggestionController::class.java,
                    com.kgd.game.presentation.admin.controller.GameSuggestionAdminController::class.java,
                ).forEach { ctx.getBeanNamesForType(it).size shouldBe 1 }
            }

        Then("game 마이그레이션은 game_db 에만 적용되어 시드 게임들이 조회된다")
            .config(enabledIf = { dockerAvailable }) {
                val gameRepository = ctx.getBean(
                    com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository::class.java
                )
                // 시드는 마이그레이션이 늘 때마다 증가한다 — 정확한 수 대신 최초 시드(V2+V3, 6종)를
                // 하한으로 검증해 신규 게임 등록이 이 스펙을 깨지 않게 한다
                (gameRepository.count() >= 6).shouldBeTrue()
                // 이 스펙이 지키는 것은 "game 마이그레이션이 game_db 에 적용됐는가" 다.
                // 제목은 운영 중 바뀌는 콘텐츠라(V40 재작명) 여기에 못 박으면 개명할 때마다 깨진다.
                // 불변인 것은 슬러그 — 행의 존재로 확인한다.
                gameRepository.findBySlug("concept-cascade").shouldNotBeNull()
                gameRepository.findBySlug("snake").shouldNotBeNull()
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("code_dictionary_db")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use { it.execute("CREATE DATABASE IF NOT EXISTS game_db") }
                    }
                }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val container = mysql ?: return
            val cdUrl = container.jdbcUrl
            val gameUrl = cdUrl.replace("/code_dictionary_db", "/game_db")
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.$role.jdbc-url") { cdUrl }
                registry.add("spring.datasource.$role.username") { container.username }
                registry.add("spring.datasource.$role.password") { container.password }
                registry.add("spring.datasource.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.game.$role.jdbc-url") { gameUrl }
                registry.add("spring.datasource.game.$role.username") { container.username }
                registry.add("spring.datasource.game.$role.password") { container.password }
                registry.add("spring.datasource.game.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            // 호스트 Flyway 는 자기 스키마(code_dictionary_db)로, game Flyway 는 game_db 로 각각 적용
            registry.add("spring.flyway.url") { cdUrl }
            registry.add("spring.flyway.user") { container.username }
            registry.add("spring.flyway.password") { container.password }
        }
    }
}
