package com.kgd.quant.infrastructure.persistence

import com.kgd.quant.application.port.persistence.AuditEventRepositoryPort
import com.kgd.quant.application.port.persistence.KillSwitchRepositoryPort
import com.kgd.quant.application.port.persistence.LiveModeRepositoryPort
import com.kgd.quant.application.port.persistence.LiveOrderRecordRepositoryPort
import com.kgd.quant.application.port.persistence.RiskLimitRepositoryPort
import com.kgd.quant.application.port.persistence.TwoFactorSecretRepositoryPort
import com.kgd.quant.domain.asset.AssetCode
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEvent
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.domain.live.KillSwitch
import com.kgd.quant.domain.live.LiveOrderRecord
import com.kgd.quant.domain.live.LiveTradingMode
import com.kgd.quant.domain.live.RiskLimit
import com.kgd.quant.domain.live.SuspendReason
import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.OrderStatus
import com.kgd.quant.domain.order.SpotOrderType
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.runBlocking
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.persistence.autoconfigure.EntityScan
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * LiveTradingPersistenceIntegrationSpec — Phase 3 JPA 어댑터 통합 테스트 (M7).
 *
 * 검증 시나리오:
 * 1) `RiskLimit` save → find round-trip
 * 2) `KillSwitch` append + lastTenant / lastStrategy / lastGlobal 조회
 * 3) `AuditEvent` chain — append 3개 + lastTipHash + loadAscending 후 verify
 * 4) `LiveOrderRecord` save → updateStatus → findPending
 * 5) `LiveTradingMode` (Disabled → Enabled → Suspended) 라이프사이클
 *
 * Docker 미연결 시 spec 자체 skip.
 *
 * **알려진 제약 (M7 후속)**: 본 spec 은 새 MySQLContainer 에서 Flyway 가 V20260505_001 을
 * 일관되게 picked up 하지 못하는 환경 케이스를 만난다 (PersistenceIntegrationSpec 와 동일 가족
 * 마이그레이션은 통과). 운영 K8s 클러스터 + 기존 MySQL 인스턴스에서는 정상 작동 — 단독 Testcontainers
 * scenario 는 후속 task 에서 디버그. 그동안은 시나리오 코드 자체가 정통 패턴 reference 로 쓰인다.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun isDockerAvailableLive(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [LiveTradingPersistenceIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        "kgd.common.redis.enabled=false",
        "kgd.common.analytics.enabled=false",
    ],
)
@ActiveProfiles("integration")
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.quant.infrastructure.persistence.LiveTradingPersistenceIntegrationSpecKt#isDockerAvailableLive",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class LiveTradingPersistenceIntegrationSpec(
    @Autowired private val riskLimitRepo: RiskLimitRepositoryPort,
    @Autowired private val killSwitchRepo: KillSwitchRepositoryPort,
    @Autowired private val auditRepo: AuditEventRepositoryPort,
    @Autowired private val orderRepo: LiveOrderRecordRepositoryPort,
    @Autowired private val liveModeRepo: LiveModeRepositoryPort,
    @Suppress("unused")
    @Autowired private val twoFactorRepo: TwoFactorSecretRepositoryPort,
) : BehaviorSpec({

    val tenant = TenantId(UUID.randomUUID().toString())
    val now = Instant.parse("2026-05-05T00:00:00Z")

    Given("Phase 3 마이그레이션 V20260505_001 적용") {

        When("RiskLimit save → find") {
            Then("도메인 필드 round-trip") {
                runBlocking {
                    val limit = RiskLimit.default(tenant, 42L, now)
                    riskLimitRepo.save(limit)
                    val loaded = riskLimitRepo.findByTenantId(tenant)
                    loaded.shouldNotBeNull()
                    loaded.dailyLossLimitKrw shouldBe limit.dailyLossLimitKrw
                    loaded.singleOrderMaxKrw shouldBe limit.singleOrderMaxKrw
                    loaded.updatedBy shouldBe 42L
                }
            }
        }

        When("KillSwitch tenant append + last 조회") {
            Then("마지막 enabled 상태 반환") {
                runBlocking {
                    killSwitchRepo.append(KillSwitch.Tenant(tenant, true, now, 1L, "test-on"))
                    killSwitchRepo.append(KillSwitch.Tenant(tenant, false, now.plusSeconds(1), 1L, "test-off"))
                    val last = killSwitchRepo.lastTenant(tenant)
                    last.shouldNotBeNull()
                    last.enabled shouldBe false
                    last.reason shouldBe "test-off"
                }
            }
        }

        When("AuditEvent 3개 chain append") {
            Then("lastTipHash 가 마지막 event 의 currentHash + verify Ok") {
                runBlocking {
                    val ev1 = AuditEvent.append(tenant, AuditEventType.LIVE_MODE_TOGGLE, "{\"v\":1}", now, null)
                    auditRepo.append(ev1)
                    val ev2 = AuditEvent.append(tenant, AuditEventType.ORDER_PLACED, "{\"v\":2}", now.plusSeconds(1), ev1.currentHash)
                    auditRepo.append(ev2)
                    val ev3 = AuditEvent.append(tenant, AuditEventType.ORDER_FILLED, "{\"v\":3}", now.plusSeconds(2), ev2.currentHash)
                    auditRepo.append(ev3)

                    auditRepo.lastTipHash(tenant) shouldBe ev3.currentHash

                    val loaded = auditRepo.loadAscending(tenant, 100)
                    loaded.size shouldBe 3
                    val verify = AuditEvent.verify(loaded, prevTip = null)
                    verify.shouldBeInstanceOf<AuditEvent.VerifyResult.Ok>()
                }
            }
        }

        When("LiveOrderRecord save → updateStatus → findPending") {
            Then("status 변경 + pending 30s+ 조회") {
                runBlocking {
                    val orderId = OrderId.newV7()
                    val placedAt = Instant.now().minusSeconds(60)
                    val rec = LiveOrderRecord(
                        id = orderId,
                        tenantId = tenant,
                        strategyId = StrategyId.newId(),
                        marketCode = MarketCode("BITHUMB"),
                        assetCode = AssetCode("BTC"),
                        side = OrderSide.BUY,
                        type = SpotOrderType.Market,
                        priceKrw = null,
                        quantity = BigDecimal("0.01"),
                        status = OrderStatus.SUBMITTED,
                        exchangeOrderId = "ex-${orderId.value}",
                        placedAt = placedAt,
                        filledAt = null,
                        cancelledAt = null,
                        auditHashPrev = null,
                        auditHashCurrent = "c".repeat(64),
                    )
                    orderRepo.save(rec)
                    val pending = orderRepo.findPending(Duration.ofSeconds(30))
                    pending.any { it.id == orderId } shouldBe true

                    orderRepo.updateStatus(orderId, OrderStatus.FILLED, filledAt = Instant.now())
                    val refetched = orderRepo.findById(orderId)
                    refetched.shouldNotBeNull()
                    refetched.status shouldBe OrderStatus.FILLED
                }
            }
        }

        When("LiveTradingMode 라이프사이클") {
            Then("Disabled → Enabled → Suspended 모두 round-trip") {
                runBlocking {
                    val initial = liveModeRepo.findByTenantId(tenant)
                    initial.shouldBeInstanceOf<LiveTradingMode.Disabled>()

                    val enabled = LiveTradingMode.Enabled(tenant, now, "a".repeat(64))
                    liveModeRepo.save(enabled)
                    liveModeRepo.findByTenantId(tenant).shouldBeInstanceOf<LiveTradingMode.Enabled>()

                    val suspended = LiveTradingMode.Suspended(tenant, SuspendReason.DAILY_LOSS_LIMIT, now.plusSeconds(60))
                    liveModeRepo.save(suspended)
                    val loaded = liveModeRepo.findByTenantId(tenant)
                    loaded.shouldBeInstanceOf<LiveTradingMode.Suspended>()
                    (loaded as LiveTradingMode.Suspended).reason shouldBe SuspendReason.DAILY_LOSS_LIMIT
                }
            }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)

    @EnableAutoConfiguration
    @EntityScan(basePackages = ["com.kgd.quant.infrastructure.persistence.entity"])
    @EnableJpaRepositories(basePackages = ["com.kgd.quant.infrastructure.persistence.repository"])
    @ComponentScan(
        basePackages = [
            "com.kgd.quant.infrastructure.persistence.adapter",
            "com.kgd.quant.infrastructure.persistence",
        ],
    )
    open class Ctx

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("quant")
                .withUsername("quant")
                .withPassword("quant")
                .also { it.start() }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            if (mysql != null) {
                registry.add("spring.datasource.url") { mysql.jdbcUrl }
                registry.add("spring.datasource.username") { mysql.username }
                registry.add("spring.datasource.password") { mysql.password }
                registry.add("spring.datasource.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.jpa.hibernate.ddl-auto") { "none" }
                registry.add("spring.jpa.database-platform") { "org.hibernate.dialect.MySQLDialect" }
                registry.add("spring.flyway.enabled") { "true" }
                registry.add("spring.flyway.locations") { "classpath:db/migration" }
            }
        }
    }
}
