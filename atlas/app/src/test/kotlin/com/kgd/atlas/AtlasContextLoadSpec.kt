package com.kgd.atlas

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
 * ADR-0093 — atlas 단독 컨텍스트 로드 검증 (옛 code-dictionary).
 *
 * 폴드된 넷이 전부 떠난 뒤, 남은 자기 도메인이 온전히 뜨는지와 떠난 것들의 빈이 남지
 * 않았는지를 확인한다. Spring 은 기본적으로 빈 오버라이드를 막으므로,
 * 컨텍스트가 뜬다는 것 자체가 충돌 부재의 증거다 (배포 시 파드 기동 실패를 사전 차단).
 *
 * **ADR-0093 으로 game 은 content 파드로 옮겼다** — 그쪽 검증은 `ContentContextLoadSpec` 이 한다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun atlasDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [AtlasApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.bootstrap-servers=localhost:9092",
        "opensearch.uris=http://localhost:9200",
        // 로더는 켠 채로 둔다 — 실제 파일이 실제 호스트 컨텍스트에서 적용되는지 여기서 본다.
        // 색인(OpenSearch)은 없으니 파생물 갱신은 재시도 없이 한 번 실패하고 끝나게 한다.
        "ontology.sync.backoff-ms=",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.atlas.AtlasContextLoadSpecKt#atlasDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class AtlasContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec({

    Given("폴드가 전부 빠진 atlas 컨텍스트") {
        Then("호스트 EMF/TM 과 QueryFactory 가 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "entityManagerFactory", "transactionManager", "jpaQueryFactory",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
            }

        // 설정 파일이 아니라 떠 있는 HikariDataSource 의 값을 읽는다. 풀 키가 `hikari.` 하위에 있으면
        // DataSourceBuilder 로 만든 풀에 바인딩되지 않아 기본값(최대 10 · 유휴 최소 10)으로 뜬다.
        Then("MySQL 풀이 전부 최대 5 · 유휴 최소 1 이다")
            .config(enabledIf = { dockerAvailable }) {
                val pools = ctx.getBeansOfType(com.zaxxer.hikari.HikariDataSource::class.java)
                    .filterValues { it.jdbcUrl.startsWith("jdbc:mysql:") }
                pools.mapValues { it.value.maximumPoolSize to it.value.minimumIdle } shouldBe
                    listOf("masterDataSource", "replicaDataSource").associateWith { 5 to 1 }
            }

        // ADR-0093 회귀 방어 — game 이 content 로 떠난 뒤 여기 남아 있으면 안 된다.
        Then("game 의 빈은 더 이상 이 컨텍스트에 없다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "gameEntityManagerFactory", "gameTransactionManager", "gameFlyway",
                ).forEach { ctx.containsBean(it) shouldBe false }
            }

        // ADR-0093 ② 완료 — deal 은 commerce, ranking 은 content 로 갔다.
        Then("deal·ranking·blog 의 빈은 더 이상 이 컨텍스트에 없다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "dealDataSource", "dealEntityManagerFactory", "dealFlyway",
                    "rankingDataSource", "rankingEntityManagerFactory", "rankingFlyway",
                    // 전환 기간에만 있던 별칭 — ranking 이 떠난 뒤엔 없어야 한다.
                    "rankingTransactionManager",
                    "blogDataSource", "blogEntityManagerFactory", "blogFlyway",
                    "blogTransactionManager",
                ).forEach { ctx.containsBean(it) shouldBe false }
            }

        /**
         * **자기 도메인의 컨트롤러가 실제로 매핑되는지** 본다.
         *
         * scanBasePackages 에서 패키지를 빠뜨리면 컨텍스트는 멀쩡히 뜨고 Flyway 도 돌지만
         * 그 API 만 조용히 404 가 된다 — 기동 실패가 아니라서 배포 후에야 드러난다
         * (ADR-0072 blog 폴드 때 실제로 겪었다).
         *
         * ADR-0093 ②③ 이후 이 호스트에 남은 것은 자기 도메인뿐이다(개념사전·포트폴리오·
         * 전시·이력서). 폴드된 넷(game·deal·ranking·blog)은 전부 떠났다.
         */
        Then("부팅 로더가 온톨로지 파일 revision 을 상태 행에 적용했다")
            .config(enabledIf = { dockerAvailable }) {
                val jdbc = org.springframework.jdbc.core.JdbcTemplate(ctx.getBean("dataSource", javax.sql.DataSource::class.java))
                // 기대값은 이미지에 실린 파일에서 — revision 을 올리거나 개념을 더할 때마다 테스트 숫자를 고치지 않게
                val resolver = org.springframework.core.io.support.PathMatchingResourcePatternResolver()
                val revision = resolver.getResource("classpath:ontology/manifest.yaml").inputStream.bufferedReader()
                    .readLines().first { it.startsWith("revision:") }.substringAfter(":").trim().toInt()
                jdbc.queryForObject("SELECT revision FROM ontology_state WHERE id = 1", Int::class.java).shouldNotBeNull() shouldBe revision
                val yamls = resolver.getResources("classpath:ontology/*.yaml").filter { it.filename != "manifest.yaml" }
                val conceptLines = yamls.sumOf { r -> r.inputStream.bufferedReader().readLines().count { it.startsWith("  - id: ") } }
                jdbc.queryForObject("SELECT COUNT(*) FROM concept WHERE managed_by IS NOT NULL AND kind IS NOT NULL", Int::class.java) shouldBe
                    conceptLines
                jdbc.queryForObject("SELECT COUNT(DISTINCT managed_by) FROM concept WHERE managed_by IS NOT NULL", Int::class.java) shouldBe
                    yamls.size
            }

        Then("개념 하나의 관계를 개념 수천 개 위에서 곧바로 낸다 — 간선 · 개념 전량을 읽지 않는다")
            .config(enabledIf = { dockerAvailable }) {
                val relations = ctx.getBean(com.kgd.codedictionary.application.graph.usecase.ConceptRelationsUseCase::class.java)
                val started = System.nanoTime()
                val r = relations.getRelations("ann-search")
                val elapsedMs = (System.nanoTime() - started) / 1_000_000
                (r.outgoing.size + r.incoming.size > 3) shouldBe true
                // 전량을 읽던 옛 경로는 운영에서 3.5초였다(동의어 EAGER 포함). 여유를 크게 두고 자릿수만 막는다
                (elapsedMs < 2_000) shouldBe true
            }

        Then("자기 도메인의 컨트롤러가 전부 빈으로 등록된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    com.kgd.codedictionary.presentation.resume.controller.ResumeController::class.java,
                    // `/r/**` 단축 주소 — 빠지면 배포 후 조용히 404 가 난다
                    com.kgd.codedictionary.presentation.resume.controller.ResumeShortLinkController::class.java,
                    com.kgd.codedictionary.presentation.portfolio.controller.PortfolioCardController::class.java,
                    com.kgd.codedictionary.presentation.concept.controller.ConceptController::class.java,
                    com.kgd.codedictionary.presentation.display.controller.DisplayServiceController::class.java,
                    com.kgd.codedictionary.presentation.graph.controller.ConceptRelationsController::class.java,
                ).forEach { ctx.getBeanNamesForType(it).size shouldBe 1 }
            }
    }

    /**
     * 이력서 단축 주소를 실제 MySQL 에서 본다. 대소문자 구분은 컬럼 콜레이션(ascii_bin)이 정하고,
     * 누적 수 증가는 네이티브 upsert 와 트랜잭션 관리자 배선이 정한다 — 둘 다 목으로는 확인할 수 없다.
     */
    Given("이력서 단축 주소 — 실제 MySQL") {
        Then("단축 코드 마이그레이션이 적용돼 모든 링크가 형식에 맞는 코드를 갖는다")
            .config(enabledIf = { dockerAvailable }) {
                val jdbc = jdbc(ctx)
                jdbc.queryForObject(
                    "SELECT success FROM flyway_schema_history WHERE version = '22'",
                    Boolean::class.java,
                ) shouldBe true
                jdbc.queryForObject(
                    "SELECT COLLATION_NAME, IS_NULLABLE FROM information_schema.COLUMNS " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resume_share_link' AND COLUMN_NAME = 'short_code'",
                ) { rs, _ -> rs.getString(1) to rs.getString(2) } shouldBe ("ascii_bin" to "NO")
                // 형식 CHECK 가 실제로 걸려 있다 — 9자 코드는 들어가지 않는다
                runCatching {
                    jdbc.update(
                        "INSERT INTO resume_share_link (token, short_code, label) VALUES (?, ?, ?)",
                        "checkcheckcheckcheck01", "Ab3dE6gH9", "형식 위반",
                    )
                }.isFailure.shouldBeTrue()
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM resume_share_link " +
                        "WHERE NOT REGEXP_LIKE(short_code, '^[0-9A-Za-z]{10}$', 'c')",
                    Long::class.java,
                ) shouldBe 0L
            }

        Then("링크를 만들면 코드가 붙고, 클릭을 적재하면 누적 수가 정확히 1 오른다")
            .config(enabledIf = { dockerAvailable }) {
                val jdbc = jdbc(ctx)
                val manage = ctx.getBean(com.kgd.codedictionary.application.resume.usecase.ManageResumeUseCase::class.java)
                val record = ctx.getBean(
                    com.kgd.codedictionary.application.resume.usecase.RecordResumeShortLinkClickUseCase::class.java,
                )
                val created = manage.createShareLink(
                    com.kgd.codedictionary.application.resume.dto.ResumeShareLinkCreateRequest(label = "컨텍스트 로드 검증"),
                )
                val code = jdbc.queryForObject(
                    "SELECT short_code FROM resume_share_link WHERE id = ?", String::class.java, created.id,
                )
                Regex("^[0-9A-Za-z]{10}$").matches(code!!).shouldBeTrue()

                fun clickCount(): Long = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(click_count), 0) FROM resume_short_link_stat WHERE share_link_id = ?",
                    Long::class.java, created.id,
                )!!
                fun ledgerRows(): Long = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM resume_short_link_click WHERE share_link_id = ?",
                    Long::class.java, created.id,
                )!!

                val was = clickCount()
                val wasRows = ledgerRows()
                record.execute(created.id)
                clickCount() shouldBe was + 1
                ledgerRows() shouldBe wasRows + 1
                // 두 번째 클릭은 upsert 의 UPDATE 갈래를 탄다
                record.execute(created.id)
                clickCount() shouldBe was + 2
            }

        Then("대소문자만 바꾼 코드는 해석에 실패한다")
            .config(enabledIf = { dockerAvailable }) {
                val jdbc = jdbc(ctx)
                val resolve = ctx.getBean(
                    com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase::class.java,
                )
                jdbc.update(
                    "INSERT INTO resume_share_link (token, short_code, label) VALUES (?, ?, ?)",
                    "casecasecasecasecase01", "Ab3dE6gH9k", "대소문자 검증",
                )
                resolve.execute("/Ab3dE6gH9k").outcome shouldBe
                    com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase.Outcome.RESOLVED
                resolve.execute("/aB3De6Gh9K").outcome shouldBe
                    com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase.Outcome.NOT_FOUND
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        private fun jdbc(ctx: ApplicationContext) =
            org.springframework.jdbc.core.JdbcTemplate(ctx.getBean("masterDataSource", javax.sql.DataSource::class.java))

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
