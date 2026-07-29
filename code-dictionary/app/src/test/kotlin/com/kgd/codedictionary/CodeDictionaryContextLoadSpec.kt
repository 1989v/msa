package com.kgd.codedictionary

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
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

        Then("game 마이그레이션은 game_db 에만 적용되어 시드 6종이 조회된다")
            .config(enabledIf = { dockerAvailable }) {
                val gameRepository = ctx.getBean(
                    com.kgd.game.infrastructure.persistence.catalog.repository.GameJpaRepository::class.java
                )
                // V2 내장 퀴즈 4종 + V3 아케이드 2종(#23 흡수)
                gameRepository.count() shouldBe 6
                gameRepository.findBySlug("concept-cascade")?.title shouldBe "Concept Cascade"
                gameRepository.findBySlug("snake")?.title shouldBe "Snake Arcade"
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
