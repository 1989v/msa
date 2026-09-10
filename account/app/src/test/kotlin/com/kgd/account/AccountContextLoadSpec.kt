package com.kgd.account

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
 * ADR-0093 — account 모듈러 모놀리스 **전체 컨텍스트 로드** 검증.
 *
 * 보는 것 둘:
 * 1. member·wishlist 의 전용 EMF/TM 이 한 JVM 에서 충돌 없이 뜨는가
 * 2. **primary 가 실제로 member 인가.** commerce 에 있을 때는 inventory 가 primary 라
 *    둘 다 비-@Primary 였다. 그대로 옮기면 primary 가 없어 타입 주입이
 *    NoUniqueBeanDefinition 으로 깨진다 — 이름만 세는 검사는 그걸 못 잡으므로
 *    `DataSource` 를 **타입으로** 받아 member 것과 같은 객체인지 본다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun accountDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [AccountApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        // member 는 전용 Flyway 를 갖는다(ADR-0078) — 호스트 토글로는 안 꺼진다.
        // 끄지 않으면 ddl-auto 가 테이블을 만들기 전에 V2 의 ALTER 가 돌아 로드가 깨진다.
        "member.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.kafka.bootstrap-servers=localhost:9092",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.account.AccountContextLoadSpecKt#accountDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class AccountContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
    /** 타입으로 받는다 — primary 가 없거나 둘이면 여기서 주입이 깨진다 */
    @Autowired private val primaryDs: DataSource,
    @Autowired @Qualifier("memberDataSource") private val memberDs: DataSource,
    @Autowired @Qualifier("wishlistDataSource") private val wishlistDs: DataSource,
) : BehaviorSpec({

    Given("account 모듈러 모놀리스 (member + wishlist 한 JVM)") {
        Then("두 도메인의 EMF/TM 이 충돌 없이 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "memberEntityManagerFactory", "memberTransactionManager",
                    "wishlistEntityManagerFactory", "wishlistTransactionManager",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
            }

        Then("primary 는 member 다 — 없으면 타입 주입이 깨진다") {
            (primaryDs === memberDs) shouldBe true
            (memberDs === wishlistDs) shouldBe false
        }

        Then("두 datasource 가 서로 다른 스키마를 본다") {
            fun schemaOf(ds: DataSource) = ds.connection.use { it.catalog }
            schemaOf(memberDs) shouldBe "member_db"
            schemaOf(wishlistDs) shouldBe "wishlist_db"
        }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("member_db")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use { it.execute("CREATE DATABASE IF NOT EXISTS wishlist_db") }
                    }
                }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val c = mysql ?: return
            val mem = c.jdbcUrl
            val wish = mem.replace("/member_db", "/wishlist_db")
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.member.$role.jdbc-url") { mem }
                registry.add("spring.datasource.member.$role.username") { c.username }
                registry.add("spring.datasource.member.$role.password") { c.password }
                registry.add("spring.datasource.member.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.wishlist.$role.jdbc-url") { wish }
                registry.add("spring.datasource.wishlist.$role.username") { c.username }
                registry.add("spring.datasource.wishlist.$role.password") { c.password }
                registry.add("spring.datasource.wishlist.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
        }
    }
}
