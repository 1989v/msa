package com.kgd.commerce.promotion

import com.kgd.commerce.CommerceApplication
import com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase
import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.application.hold.port.HoldEventType
import com.kgd.promotion.application.hold.usecase.ExpirePromotionHoldsUseCase
import com.kgd.promotion.application.hold.usecase.HoldAnswer
import com.kgd.promotion.application.hold.usecase.ProcessPromotionCommandUseCase
import com.kgd.promotion.application.point.usecase.GrantPointsUseCase
import com.kgd.promotion.domain.coupon.exception.CouponAlreadyIssuedException
import com.kgd.promotion.domain.coupon.exception.CouponSoldOutException
import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponLine
import com.kgd.promotion.domain.coupon.model.CouponType
import com.kgd.promotion.domain.hold.model.PromotionFailureReason
import com.kgd.promotion.infrastructure.outbox.PromotionOutboxRepository
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.sql.DataSource
import kotlin.reflect.KClass

/**
 * 혜택 도메인을 실제 MySQL(promotion_db, Flyway V1 + EMF validate)로 — 조건부 UPDATE·유니크·CHECK·`@Version`·
 * 만료 조회 JPQL 은 메모리 저장소로는 잴 수 없다. 판정 근거는 DB 행 수·값과 아웃박스 행이다.
 *
 * Docker 가 없으면 로컬에선 건너뛰지만 `CI=true` 면 그대로 실행해 **실패**한다(초록불로 넘어가지 않게).
 */
@EnabledIf(PromotionIntegrationSpec.DockerOrCi::class)
@SpringBootTest(
    classes = [CommerceApplication::class],
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        "outbox.polling.enabled=false",
        "product.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "spring.kafka.bootstrap-servers=localhost:9092",
        // 스케줄 만료가 테스트가 부르는 만료와 섞이지 않게 첫 실행을 미룬다
        "promotion.hold-expiry.initial-delay-ms=3600000",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    ],
)
class PromotionIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    init {
        val definitions = ctx.getBean(ManageCouponDefinitionUseCase::class.java)
        val claims = ctx.getBean(ClaimCouponUseCase::class.java)
        val grants = ctx.getBean(GrantPointsUseCase::class.java)
        val commands = ctx.getBean(ProcessPromotionCommandUseCase::class.java)
        val expiry = ctx.getBean(ExpirePromotionHoldsUseCase::class.java)
        val outbox = ctx.getBean(PromotionOutboxRepository::class.java)
        val objectMapper = ctx.getBean(ObjectMapper::class.java)
        val jdbc = JdbcTemplate(ctx.getBean("promotionMasterDataSource", DataSource::class.java))

        fun define(limit: Int): Long {
            val now = Instant.now()
            return definitions.create(
                ManageCouponDefinitionUseCase.Create(
                    name = "동시 발급", type = CouponType.FIXED, amount = 1_000L, rateBp = null, maxDiscount = null,
                    minOrderAmount = 0L, validFrom = now.minusSeconds(3600), validUntil = now.plusSeconds(86_400),
                    issueLimit = limit, bearer = CouponBearer.PLATFORM, sellerId = null, actorId = "1",
                ),
            ).id
        }

        /** [members] 를 동시에 출발시켜 받게 하고 결과(성공 또는 예외)를 모은다 */
        fun claimConcurrently(definitionId: Long, members: List<String>): List<Result<Any>> {
            val pool = Executors.newFixedThreadPool(16)
            val start = CountDownLatch(1)
            try {
                val futures = members.map { m -> pool.submit(Callable { start.await(); runCatching<Any> { claims.claim(m, definitionId) } }) }
                start.countDown()
                return futures.map { it.get(60, TimeUnit.SECONDS) }
            } finally {
                pool.shutdownNow()
            }
        }

        fun issuedCount(definitionId: Long) =
            jdbc.queryForObject("SELECT issued_count FROM coupon_definition WHERE id = ?", Int::class.java, definitionId)

        fun userCoupons(definitionId: Long) =
            jdbc.queryForObject("SELECT COUNT(*) FROM user_coupon WHERE coupon_definition_id = ?", Long::class.java, definitionId)

        fun balance(memberId: String) =
            jdbc.queryForObject("SELECT balance FROM point_balance WHERE member_id = ?", Long::class.java, memberId)

        Given("발행 상한 30 쿠폰에 서로 다른 회원 100명이 동시에 받는다") {
            Then("정확히 30장 — 나머지 70은 소진, 발행 수 = 사용자 쿠폰 행 수 = 30") {
                val id = define(limit = 30)
                val results = claimConcurrently(id, (1..100).map { "burst-$it" })

                results.count { it.isSuccess } shouldBe 30
                results.mapNotNull { it.exceptionOrNull() }.map { it::class }.toSet() shouldBe setOf(CouponSoldOutException::class)
                issuedCount(id) shouldBe 30
                userCoupons(id) shouldBe 30L
            }
        }

        Given("같은 회원이 같은 쿠폰을 동시에 10번 받는다") {
            Then("한 장만 — 나머지는 이미 받음, 발행 수도 1 (유니크 위반이 증가분까지 되돌린다)") {
                val id = define(limit = 30)
                val results = claimConcurrently(id, List(10) { "same-member" })

                results.count { it.isSuccess } shouldBe 1
                results.mapNotNull { it.exceptionOrNull() }.map { it::class }.toSet() shouldBe setOf(CouponAlreadyIssuedException::class)
                issuedCount(id) shouldBe 1
                userCoupons(id) shouldBe 1L
            }
        }

        Given("포인트 잔액 CHECK") {
            Then("서비스를 거치지 않은 음수 잔액 UPDATE 도 DB 가 거부한다") {
                grants.grant(GrantPointsUseCase.Grant("check-member", 100L, "1", "검사"))
                shouldThrow<DataAccessException> {
                    jdbc.update("UPDATE point_balance SET balance = -1 WHERE member_id = 'check-member'")
                }
                balance("check-member") shouldBe 100L
            }
        }

        Given("같은 orderId 보류 명령 두 번 → 만료된 보류에 확정 명령") {
            Then("보류 행 1 · 원장 USE 1 · 잔액 한 번만 차감, 확정은 예외 없이 failed(EXPIRED) + 되돌림") {
                grants.grant(GrantPointsUseCase.Grant("tcc-member", 5_000L, "1", "검사"))
                val reserve = ProcessPromotionCommandUseCase.Reserve(
                    orderId = 770001L, memberId = "tcc-member", userCouponId = null, couponDiscount = 0L,
                    pointAmount = 3_000L, lines = listOf(CouponLine(1L, 20_000L)),
                )
                commands.reserve(reserve) shouldBe HoldAnswer(HoldEventType.RESERVED)
                commands.reserve(reserve) shouldBe HoldAnswer(HoldEventType.RESERVED)

                jdbc.queryForObject("SELECT COUNT(*) FROM promotion_hold WHERE order_id = 770001", Long::class.java) shouldBe 1L
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM point_ledger WHERE order_id = 770001 AND type = 'USE'", Long::class.java,
                ) shouldBe 1L
                balance("tcc-member") shouldBe 2_000L

                // 30분이 지난 것으로 만든다 — 스케줄러가 아직 돌지 않은 상태
                jdbc.update("UPDATE promotion_hold SET expires_at = '2000-01-01 00:00:00' WHERE order_id = 770001")

                commands.confirm(770001L) shouldBe HoldAnswer(HoldEventType.FAILED, PromotionFailureReason.EXPIRED)
                jdbc.queryForObject("SELECT status FROM promotion_hold WHERE order_id = 770001", String::class.java) shouldBe "EXPIRED"
                balance("tcc-member") shouldBe 5_000L

                val holdRows = outbox.findAll().filter { it.partitionKey == "770001" }
                holdRows.map { it.eventType } shouldContainAll listOf("promotion.hold.reserved", "promotion.hold.expired", "promotion.hold.failed")
                objectMapper.readTree(holdRows.single { it.eventType == "promotion.hold.failed" }.payload)["reason"].asString() shouldBe "EXPIRED"
            }
        }

        Given("기한이 지난 보류가 스케줄러 만료를 기다린다") {
            Then("만료 조회가 그 주문을 집어 EXPIRED + promotion.hold.expired, 포인트가 돌아온다") {
                grants.grant(GrantPointsUseCase.Grant("expiry-member", 1_000L, "1", "검사"))
                commands.reserve(
                    ProcessPromotionCommandUseCase.Reserve(
                        orderId = 770002L, memberId = "expiry-member", userCouponId = null, couponDiscount = 0L,
                        pointAmount = 1_000L, lines = listOf(CouponLine(1L, 5_000L)),
                    ),
                )
                jdbc.update("UPDATE promotion_hold SET expires_at = '2000-01-01 00:00:00' WHERE order_id = 770002")

                (expiry.expireDue() >= 1) shouldBe true
                jdbc.queryForObject("SELECT status FROM promotion_hold WHERE order_id = 770002", String::class.java) shouldBe "EXPIRED"
                balance("expiry-member") shouldBe 1_000L
                outbox.findAll().count { it.partitionKey == "770002" && it.eventType == "promotion.hold.expired" } shouldBe 1
            }
        }
    }

    class DockerOrCi : EnabledCondition {
        override fun enabled(kclass: KClass<out Spec>): Boolean = dockerAvailable || isCi
    }

    companion object {
        private val isCi = System.getenv("CI") == "true"
        private val dockerAvailable: Boolean =
            runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

        private val mysql: MySQLContainer<*> by lazy {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("inventory_db")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use { st ->
                            listOf("warehouse_db", "fulfillment_db", "order_db", "product_db", "deal_db", "seller_db", "payment_db", "promotion_db")
                                .forEach { st.execute("CREATE DATABASE IF NOT EXISTS $it") }
                        }
                    }
                }
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val inv = mysql.jdbcUrl
            fun ds(prefix: String, url: String) {
                registry.add("$prefix.jdbc-url") { url }
                registry.add("$prefix.username") { mysql.username }
                registry.add("$prefix.password") { mysql.password }
                registry.add("$prefix.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            for (role in listOf("master", "replica")) {
                ds("spring.datasource.$role", inv)
                for (domain in listOf("warehouse", "fulfillment", "order", "product", "seller", "payment", "promotion")) {
                    ds("spring.datasource.$domain.$role", inv.replace("/inventory_db", "/${domain}_db"))
                }
            }
            registry.add("spring.datasource.deal.url") { inv.replace("/inventory_db", "/deal_db") }
            registry.add("spring.datasource.deal.username") { mysql.username }
            registry.add("spring.datasource.deal.password") { mysql.password }
            registry.add("spring.datasource.deal.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
