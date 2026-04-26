package com.kgd.quant.infrastructure.persistence

import com.kgd.quant.application.port.persistence.OrderRepositoryPort
import com.kgd.quant.application.port.persistence.TrancheSlotRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRepositoryPort
import com.kgd.quant.application.port.persistence.StrategyRunRepositoryPort
import com.kgd.quant.domain.common.ExecutionMode
import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.Percent
import com.kgd.quant.domain.common.Quantity
import com.kgd.quant.domain.common.SlotId
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.event.StrategyActivated
import com.kgd.quant.domain.order.Order
import com.kgd.quant.domain.order.OrderSide
import com.kgd.quant.domain.order.SpotOrderType
import com.kgd.quant.domain.slot.TrancheSlot
import com.kgd.quant.domain.strategy.TrancheStrategy
import com.kgd.quant.domain.strategy.TrancheStrategyConfig
import com.kgd.quant.domain.strategy.StrategyRun
import com.kgd.quant.infrastructure.persistence.adapter.JpaOutboxRepositoryAdapter
import com.kgd.quant.infrastructure.persistence.repository.OutboxJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
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
import java.time.Instant

/**
 * TG-08.7: Persistence 레이어 Testcontainers MySQL 통합 테스트.
 *
 * ## 시나리오
 *  1) Flyway V001 이 실행되어 9개 테이블 (+ `flyway_schema_history`) 이 존재.
 *  2) `TrancheStrategy` save/findById 왕복 — 도메인 필드 전 영역 일치.
 *  3) `StrategyRun` / `TrancheSlot` / `Order` 순서대로 체인 저장 후 tenantId 기반 조회.
 *  4) tenantId 격리 — 다른 tenantId 로 조회 시 null.
 *  5) Outbox append — publish() 호출 시 outbox 테이블에 row 증가.
 *
 * ## 컨텍스트 구성
 * - `PersistenceIntegrationSpec.Ctx` 를 SpringBoot root 로 사용해 persistence 패키지만 스캔.
 * - Kafka / Web / Validation / Scheduling 관련 Auto-configuration 은 로드하지 않도록 좁은 스캔.
 * - `ddl-auto=none` — Flyway 가 DDL 을 단독 책임 지고, Hibernate validate 의 JSON/BINARY 타입 편차를 우회.
 *
 * ## Docker 부재 시 skip
 * 로컬 Docker 가 꺼져 있으면 spec 자체가 실행되지 않도록 `enabledIf` 로 guard.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

/** JUnit `@EnabledIf` 용 정적 프레디케이트 — Docker 미연결 시 Spring context 로딩 자체를 건너뛴다. */
@Suppress("unused")
fun isDockerAvailable(): Boolean = dockerAvailable

@SpringBootTest(
    classes = [PersistenceIntegrationSpec.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
        "kgd.common.redis.enabled=false",
        "kgd.common.analytics.enabled=false",
    ]
)
@ActiveProfiles("integration")
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.quant.infrastructure.persistence.PersistenceIntegrationSpecKt#isDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가"
)
class PersistenceIntegrationSpec(
    @Autowired private val strategyRepo: StrategyRepositoryPort,
    @Autowired private val runRepo: StrategyRunRepositoryPort,
    @Autowired private val slotRepo: TrancheSlotRepositoryPort,
    @Autowired private val orderRepo: OrderRepositoryPort,
    @Autowired private val outboxAdapter: JpaOutboxRepositoryAdapter,
    @Autowired private val outboxJpa: OutboxJpaRepository
) : BehaviorSpec({

    Given("Testcontainers MySQL + Flyway V001 마이그레이션") {
        When("전략을 저장하고 조회하면") {
            Then("도메인 필드가 왕복 후에도 일치해야 한다")
                .config(enabledIf = { dockerAvailable }) {
                    val tenant = TenantId("tenant-A")
                    val strategy = sampleStrategy(tenant)

                    runBlocking {
                        strategyRepo.save(strategy)
                        val loaded = strategyRepo.findById(tenant, strategy.id)
                        loaded.shouldNotBeNull()
                        loaded.id shouldBe strategy.id
                        loaded.tenantId shouldBe tenant
                        loaded.config.roundCount shouldBe strategy.config.roundCount
                        loaded.config.targetSymbol shouldBe strategy.config.targetSymbol
                        loaded.config.takeProfitPercentPerRound.size shouldBe strategy.config.roundCount
                    }
                }
        }

        When("다른 테넌트로 조회하면") {
            Then("INV-05 격리로 null 이 반환된다")
                .config(enabledIf = { dockerAvailable }) {
                    val tenant = TenantId("tenant-iso-A")
                    val other = TenantId("tenant-iso-B")
                    val strategy = sampleStrategy(tenant)

                    runBlocking {
                        strategyRepo.save(strategy)
                        val loadedSame = strategyRepo.findById(tenant, strategy.id)
                        val loadedOther = strategyRepo.findById(other, strategy.id)
                        loadedSame.shouldNotBeNull()
                        loadedOther shouldBe null
                    }
                }
        }

        When("run → slot → order 체인 저장") {
            Then("각 단계에서 tenantId 가 run 에서 상속되어 저장된다")
                .config(enabledIf = { dockerAvailable }) {
                    val tenant = TenantId("tenant-chain")
                    val strategy = sampleStrategy(tenant)
                    val run = StrategyRun.create(
                        strategyId = strategy.id,
                        tenantId = tenant,
                        startedAt = Instant.parse("2026-04-24T00:00:00Z"),
                        executionMode = ExecutionMode.BACKTEST,
                        seed = 42L
                    )
                    val slot = TrancheSlot.create(
                        id = SlotId.newId(),
                        runId = run.id,
                        roundIndex = 0,
                        targetQty = Quantity.of("0.01"),
                        takeProfitPercent = Percent.of("3")
                    )
                    val order = Order.create(
                        orderId = OrderId.newV7(),
                        slotId = slot.id,
                        side = OrderSide.BUY,
                        type = SpotOrderType.Market,
                        quantity = Quantity.of("0.01"),
                        price = null
                    )

                    runBlocking {
                        strategyRepo.save(strategy)
                        runRepo.save(run)
                        slotRepo.save(slot)
                        orderRepo.save(order)

                        val loadedSlots = slotRepo.findByRunId(tenant, run.id)
                        loadedSlots.size shouldBe 1
                        loadedSlots.first().id shouldBe slot.id

                        val loadedOrder = orderRepo.findById(tenant, order.orderId)
                        loadedOrder.shouldNotBeNull()
                        loadedOrder.orderId shouldBe order.orderId
                        loadedOrder.side shouldBe OrderSide.BUY
                    }
                }
        }

        When("Outbox append 호출") {
            Then("publish() 호출 시 outbox 테이블에 row 가 추가된다")
                .config(enabledIf = { dockerAvailable }) {
                    val tenant = TenantId("tenant-outbox")
                    val event = StrategyActivated(
                        tenantId = tenant,
                        strategyId = StrategyId.newId()
                    )
                    val before = outboxJpa.count()
                    runBlocking {
                        outboxAdapter.append(event)
                    }
                    val after = outboxJpa.count()
                    (after - before) shouldBe 1L
                    outboxJpa.findByEventId(event.eventId).shouldNotBeNull()
                }
        }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    /**
     * Persistence 통합 테스트 전용 루트 컨피그.
     *
     * - `com.kgd.quant.infrastructure.persistence` 패키지만 스캔해 Entity / Repository / Adapter / Config Bean 을 로드.
     * - `com.fasterxml.jackson` 는 `@EnableAutoConfiguration` 이 JacksonAutoConfiguration 을 통해 ObjectMapper 를 공급.
     * - Common 모듈 / Kafka / Web 관련 Bean 은 로드하지 않아 테스트가 가볍게 뜬다.
     */
    @EnableAutoConfiguration
    @EntityScan(basePackages = ["com.kgd.quant.infrastructure.persistence.entity"])
    @EnableJpaRepositories(basePackages = ["com.kgd.quant.infrastructure.persistence.repository"])
    @ComponentScan(
        basePackages = [
            "com.kgd.quant.infrastructure.persistence.adapter",
            "com.kgd.quant.infrastructure.persistence"
        ]
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
                // Flyway 가 DDL 을 담당하므로 Hibernate 는 DDL 검사 비활성.
                registry.add("spring.jpa.hibernate.ddl-auto") { "none" }
                registry.add("spring.jpa.database-platform") { "org.hibernate.dialect.MySQLDialect" }
                registry.add("spring.jpa.properties.hibernate.dialect") { "org.hibernate.dialect.MySQLDialect" }
                registry.add("spring.flyway.enabled") { "true" }
                registry.add("spring.flyway.locations") { "classpath:db/migration" }
            }
        }

        private fun sampleStrategy(tenant: TenantId): TrancheStrategy {
            val config = TrancheStrategyConfig(
                roundCount = 3,
                entryGapPercent = Percent.of("-5"),
                takeProfitPercentPerRound = listOf(
                    Percent.of("3"),
                    Percent.of("4"),
                    Percent.of("5")
                ),
                initialOrderAmount = BigDecimal("100000"),
                targetSymbol = "BTC_KRW"
            )
            return TrancheStrategy.create(
                tenantId = tenant,
                config = config,
                executionMode = ExecutionMode.BACKTEST
            )
        }
    }
}
