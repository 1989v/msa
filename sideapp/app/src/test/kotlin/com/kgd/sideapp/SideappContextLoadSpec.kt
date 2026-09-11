package com.kgd.sideapp

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.booleans.shouldBeTrue
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
 * ADR-0093 — sideapp 모듈러 모놀리스(quant + chatbot + gifticon) **전체 컨텍스트 로드** 검증.
 *
 * 이 폴드가 깨뜨리는 것은 하나다. quant 와 chatbot 은 MySQL 을 **자동 구성에 맡기고** 있었고,
 * gifticon 은 `@Primary dataSource` 빈을 직접 만들고 있었다. 셋을 한 JVM 에 올리면
 * `DataSourceAutoConfiguration`(@ConditionalOnMissingBean) 이 gifticon 의 빈 하나로 back-off 해
 * **quant·chatbot 의 JPA 가 조용히 사라진다** — 컴파일도 단위 테스트도 통과한 채로.
 *
 * 그래서 빈 이름만 세지 않는다. 세 datasource 를 **연결해서** 서로 다른 스키마를 보는지,
 * 그리고 타입 주입(primary)이 quant 로 가는지를 본다. 그 셋이 이 폴드의 전부다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun sideappDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [SideappApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        // quant 는 전용 Flyway 를 갖는다 — 호스트 토글로는 안 꺼진다.
        // 끄지 않으면 ddl-auto 가 테이블을 만들기 전에 마이그레이션이 돌아 로드가 깨진다.
        "quant.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "kgd.common.redis.enabled=false",
        "kgd.common.analytics.enabled=false",
        // ClickHouse·Postgres·외부 거래소는 이 검사에 없다. 전부 기본 비활성이라 뜨는 것이고,
        // 그 기본값을 켜면 이 검사가 죽는다.
        "quant.pgvector.enabled=false",
        "quant.audit.enabled=false",
        "quant.market.bithumb-ws.enabled=false",
        "quant.notification.dispatcher.enabled=false",
        "quant.outbox.relay.enabled=false",
        // LocalFileKmsAdapter 는 @Profile("local","test","kubernetes") 라 프로파일 없이는
        // 안 뜨고, 그러면 KeyManagementService 를 요구하는 use case 들이 전부 주입 실패한다.
        // 평문 hex 32-byte 더미 — 검사 전용, 운영 사용 금지.
        "quant.security.kms.provider=local",
        "quant.security.kms.local.current-version=v1",
        "quant.security.kms.local.kek-versions.v1=" +
            "000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f",
    ],
)
@org.springframework.test.context.ActiveProfiles("test")
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.sideapp.SideappContextLoadSpecKt#sideappDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class SideappContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
    /** 타입으로 받는다 — primary 가 없거나 둘이면 여기서 주입이 깨진다 */
    @Autowired private val primaryDs: DataSource,
    @Autowired @Qualifier("quantDataSource") private val quantDs: DataSource,
    @Autowired @Qualifier("chatbotDataSource") private val chatbotDs: DataSource,
    @Autowired @Qualifier("gifticonDataSource") private val gifticonDs: DataSource,
) : BehaviorSpec({

    Given("sideapp 모듈러 모놀리스 (quant + chatbot + gifticon 한 JVM)") {
        Then("세 도메인의 EMF/TM 이 충돌 없이 로드된다") {
            listOf(
                "quantEntityManagerFactory", "quantTransactionManager",
                "chatbotEntityManagerFactory", "chatbotTransactionManager",
                "gifticonEntityManagerFactory", "gifticonTransactionManager",
            ).forEach { ctx.containsBean(it).shouldBeTrue() }
        }

        Then("primary 는 quant 다 — 없으면 타입 주입이 깨진다") {
            (primaryDs === quantDs) shouldBe true
        }

        // 이름이 아니라 **연결이 실제로 어디로 가는지**를 본다. 빈 존재만 세면
        // 자동 구성 back-off 로 JPA 가 죽은 상태도 통과한다.
        Then("세 datasource 가 서로 다른 스키마를 본다") {
            fun schemaOf(ds: DataSource) = ds.connection.use { it.catalog }
            schemaOf(quantDs) shouldBe "quant"
            schemaOf(chatbotDs) shouldBe "chatbot_db"
            schemaOf(gifticonDs) shouldBe "gifticon_db"
        }

        Then("gifticon Querydsl 이 gifticon EMF 에 묶여 있다") {
            // 총칭 jpaQueryFactory 로 두면 primary(quant) EM 에 붙어 gifticon 질의가 quant 로 나간다.
            ctx.containsBean("gifticonJpaQueryFactory").shouldBeTrue()
            ctx.containsBean("jpaQueryFactory") shouldBe false
        }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("quant")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use { st ->
                            st.execute("CREATE DATABASE IF NOT EXISTS chatbot_db")
                            st.execute("CREATE DATABASE IF NOT EXISTS gifticon_db")
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
            val quant = c.jdbcUrl
            registry.add("spring.datasource.quant.url") { quant }
            registry.add("spring.datasource.quant.username") { c.username }
            registry.add("spring.datasource.quant.password") { c.password }
            registry.add("spring.datasource.quant.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            registry.add("spring.datasource.chatbot.url") { quant.replace("/quant", "/chatbot_db") }
            registry.add("spring.datasource.chatbot.username") { c.username }
            registry.add("spring.datasource.chatbot.password") { c.password }
            registry.add("spring.datasource.chatbot.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.gifticon.$role.jdbc-url") { quant.replace("/quant", "/gifticon_db") }
                registry.add("spring.datasource.gifticon.$role.username") { c.username }
                registry.add("spring.datasource.gifticon.$role.password") { c.password }
                registry.add("spring.datasource.gifticon.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
        }
    }
}
