package com.kgd.engagement

import com.kgd.ads.application.token.config.AdsTokenProperties
import com.kgd.ads.infrastructure.config.AdsConfig
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import javax.sql.DataSource

/**
 * ads 스키마 검사 — Flyway 가 만든 ads_db 에 대해 ads EMF 가 `validate` 로 뜨는가, 시드가 들어갔는가.
 *
 * 컨텍스트가 떴다는 것 자체가 「마이그레이션 스키마 = 엔티티 매핑」의 증거다. 다만 호스트 yml 의
 * `ddl-auto` 가 ads EMF 에 새어 들어가 `create`·`update` 로 돌면 스키마가 틀려도 Hibernate 가
 * 조용히 고쳐 버리므로, EMF 가 실제로 쓰는 값이 validate 인지 함께 본다(이 스펙은 호스트 값을 create 로 둔다).
 *
 * 서명 키 누락·길이 미달은 컨텍스트 기동 자체를 막아야 한다 — 그 판정은 설정 클래스만 올려 본다.
 */
@SpringBootTest(
    classes = [EngagementApplication::class],
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.kafka.bootstrap-servers=localhost:9092",
        "recommendation.clickhouse.url=jdbc:clickhouse://localhost:8123/analytics",
        "ADS_TOKEN_SECRET=${EngagementTestContainers.TEST_TOKEN_SECRET}",
        "ads.scheduling.enabled=false",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.engagement.EngagementContextLoadSpecKt#engagementDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class AdsSchemaIntegrationSpec(
    @Autowired @Qualifier("adsDataSource") private val adsDs: DataSource,
    @Autowired @Qualifier("adsEntityManagerFactory") private val adsEmf: EntityManagerFactory,
) : BehaviorSpec({

    val dockerAvailable = EngagementTestContainers.dockerAvailable

    Given("Flyway 가 적용된 ads_db") {
        Then("V1 이 성공으로 기록되고 ads EMF 는 validate 로 떠 있다")
            .config(enabledIf = { dockerAvailable }) {
                JdbcTemplate(adsDs).queryForObject(
                    "SELECT success FROM flyway_schema_history WHERE version = '1'",
                    Boolean::class.java,
                ) shouldBe true
                adsEmf.properties["hibernate.hbm2ddl.auto"] shouldBe "validate"
            }

        Then("지면 시드는 넷이고 deal-hub-end 는 없으며 game-list-banner 만 유료 불가다")
            .config(enabledIf = { dockerAvailable }) {
                val rows = JdbcTemplate(adsDs).queryForList("SELECT placement_key, paid_allowed FROM ad_placement")
                rows.map { it["placement_key"] as String } shouldContainExactlyInAnyOrder
                    listOf("blog-post-end", "game-hub-end", "attraction-end", "game-list-banner")
                rows.filter { it["paid_allowed"] == false }.map { it["placement_key"] } shouldBe listOf("game-list-banner")
            }

        Then("SYSTEM 광고주 하나와 네트워크 원장 계정 셋, HOUSE 소재 셋이 승인 상태로 있다")
            .config(enabledIf = { dockerAvailable }) {
                val jdbc = JdbcTemplate(adsDs)
                jdbc.queryForList("SELECT display_name FROM ad_advertiser WHERE kind = 'SYSTEM'", String::class.java) shouldBe
                    listOf("1989v 하우스")
                jdbc.queryForList(
                    "SELECT type FROM ad_ledger_account WHERE advertiser_id IS NULL",
                    String::class.java,
                ) shouldContainExactlyInAnyOrder listOf("NETWORK_REVENUE", "PUBLISHER_PAYABLE", "TOPUP_SOURCE")
                jdbc.queryForList(
                    "SELECT c.title, c.link_url, c.emoji, c.status FROM ad_creative c " +
                        "JOIN ad_campaign_placement p ON p.campaign_id = c.campaign_id " +
                        "WHERE p.placement_key = 'game-list-banner' ORDER BY c.id",
                ).map { listOf(it["title"], it["link_url"], it["emoji"], it["status"]) } shouldBe listOf(
                    listOf("IT 개념 사전", "/", "📚", "APPROVED"),
                    listOf("커머스 쇼핑", "/shop", "🛒", "APPROVED"),
                    listOf("포트폴리오", "/portfolio", "🗂️", "APPROVED"),
                )
            }
    }

    Given("토큰 서명 키 설정") {
        val runner = ApplicationContextRunner().withUserConfiguration(AdsConfig::class.java)
        val rootMessage = { f: Throwable -> generateSequence(f) { it.cause }.last().message.orEmpty() }

        Then("키가 없으면 기동하지 않는다") {
            runner.run { ctx ->
                val failure = ctx.startupFailure.shouldNotBeNull()
                rootMessage(failure) shouldContain "ads.token.secret"
            }
        }

        Then("31바이트 키면 기동하지 않는다") {
            runner.withPropertyValues("ads.token.secret=${"k".repeat(31)}").run { ctx ->
                rootMessage(ctx.startupFailure.shouldNotBeNull()) shouldContain "ads.token.secret"
            }
        }

        Then("교체용 이전 키가 31바이트면 기동하지 않는다") {
            runner.withPropertyValues(
                "ads.token.secret=${"k".repeat(32)}",
                "ads.token.secret-previous=${"p".repeat(31)}",
            ).run { ctx ->
                rootMessage(ctx.startupFailure.shouldNotBeNull()) shouldContain "ads.token.secret-previous"
            }
        }

        Then("32바이트 키면 뜨고 그 키를 쓴다") {
            runner.withPropertyValues("ads.token.secret=${"k".repeat(32)}").run { ctx ->
                ctx.startupFailure shouldBe null
                val props = ctx.getBean(AdsTokenProperties::class.java)
                props.currentKey.decodeToString() shouldBe "k".repeat(32)
                props.previousKey shouldBe null
            }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) = EngagementTestContainers.register(registry)
    }
}
