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
 * ADR-0072 — code-dictionary + blog 폴드의 **전체 컨텍스트 로드** 검증.
 *
 * 두 바운디드 컨텍스트가 한 JVM 에 스캔되므로 빈 이름 충돌이 없는지, 호스트 Flyway 가
 * 자기 스키마에만 적용되는지 확인한다. Spring 은 기본적으로 빈 오버라이드를 막으므로,
 * 컨텍스트가 뜬다는 것 자체가 충돌 부재의 증거다 (배포 시 파드 기동 실패를 사전 차단).
 *
 * **ADR-0093 으로 game 은 content 파드로 옮겼다** — 그쪽 검증은 `ContentContextLoadSpec` 이 한다.
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

    Given("code-dictionary + blog 가 한 JVM 에 폴드된 컨텍스트") {
        Then("호스트 EMF/TM 과 QueryFactory 가 충돌 없이 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "entityManagerFactory", "transactionManager", "jpaQueryFactory",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
            }

        // ADR-0093 회귀 방어 — game 이 content 로 떠난 뒤 여기 남아 있으면 안 된다.
        Then("game 의 빈은 더 이상 이 컨텍스트에 없다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "gameEntityManagerFactory", "gameTransactionManager", "gameFlyway",
                ).forEach { ctx.containsBean(it) shouldBe false }
            }

        // ADR-0093 ② 완료 — deal 은 commerce, ranking 은 content 로 갔다.
        Then("deal·ranking 의 빈은 더 이상 이 컨텍스트에 없다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "dealDataSource", "dealEntityManagerFactory", "dealFlyway",
                    "rankingDataSource", "rankingEntityManagerFactory", "rankingFlyway",
                    // 전환 기간에만 있던 별칭 — ranking 이 떠난 뒤엔 없어야 한다.
                    "rankingTransactionManager",
                ).forEach { ctx.containsBean(it) shouldBe false }
            }

        /**
         * 폴드된 도메인의 **컨트롤러가 실제로 매핑되는지** 본다.
         *
         * scanBasePackages 에서 패키지를 빠뜨리면 컨텍스트는 멀쩡히 뜨고 Flyway 도 돌지만
         * 그 도메인의 API 만 조용히 404 가 된다 — 기동 실패가 아니라서 배포 후에야 드러난다
         * (ADR-0072 blog 폴드 때 실제로 겪었다). 새 도메인을 폴드하면 여기 한 줄을 더한다.
         */
        Then("폴드된 도메인(blog)의 컨트롤러가 전부 빈으로 등록된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    com.kgd.blog.presentation.controller.BlogPublicController::class.java,
                    com.kgd.blog.presentation.controller.BlogStudioController::class.java,
                    com.kgd.blog.presentation.controller.BlogAdminController::class.java,
                    com.kgd.blog.presentation.controller.BlogPageController::class.java,
                ).forEach { ctx.getBeanNamesForType(it).size shouldBe 1 }
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
                .also { it.start() }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val container = mysql ?: return
            val cdUrl = container.jdbcUrl
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.$role.jdbc-url") { cdUrl }
                registry.add("spring.datasource.$role.username") { container.username }
                registry.add("spring.datasource.$role.password") { container.password }
                registry.add("spring.datasource.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            // 호스트 Flyway 는 자기 스키마(code_dictionary_db)에 적용
            registry.add("spring.flyway.url") { cdUrl }
            registry.add("spring.flyway.user") { container.username }
            registry.add("spring.flyway.password") { container.password }
        }
    }
}
