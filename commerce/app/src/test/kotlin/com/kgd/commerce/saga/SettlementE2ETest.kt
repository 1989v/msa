package com.kgd.commerce.saga

import com.kgd.commerce.CommerceApplication
import com.kgd.common.messaging.outbox.OutboxKafka
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.order.application.claim.usecase.RequestClaimUseCase
import com.kgd.order.application.order.usecase.ConfirmPurchaseUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.application.sheet.usecase.CreateOrderSheetUseCase
import com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase
import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.application.point.usecase.GrantPointsUseCase
import com.kgd.promotion.domain.coupon.model.CouponBearer
import com.kgd.promotion.domain.coupon.model.CouponType
import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.application.seller.usecase.ManageSellerUseCase
import com.kgd.seller.domain.seller.model.SettlementCycle
import com.kgd.settlement.application.ledger.usecase.GetTrialBalanceUseCase
import com.kgd.settlement.application.statement.usecase.GetStatementsUseCase
import com.kgd.settlement.application.statement.usecase.RunSettlementBatchUseCase
import com.kgd.settlement.domain.ledger.model.Account
import com.kgd.settlement.domain.statement.model.StatementStatus
import io.kotest.assertions.nondeterministic.eventually
import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.apache.kafka.clients.admin.AdminClient
import org.apache.kafka.clients.admin.AdminClientConfig
import org.apache.kafka.clients.admin.NewTopic
import org.apache.kafka.common.errors.TopicExistsException
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.kafka.config.KafkaListenerEndpointRegistry
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.kafka.KafkaContainer
import org.testcontainers.utility.DockerImageName
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ObjectNode
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.sql.DataSource
import kotlin.reflect.KClass
import kotlin.time.Duration.Companion.seconds

/** 정산 도메인 시계 — 정산 기간이 닫힌 날로 앞당긴다 */
@TestConfiguration(proxyBeanMethods = false)
class SettlementE2EConfig {
    /** 운영 빈 `settlementClock`(Clock.systemUTC)을 같은 이름으로 덮는다 */
    @Bean
    fun settlementClock(): Clock = AdvancingClock()
}

/**
 * 정산 E2E (스펙 SR-9). commerce 호스트 전체 + 실제 MySQL(모든 도메인 Flyway + validate) + 실제 Kafka — 사가·클레임 E2E 와 같은 구성.
 * 주문 → 매입 분개 → 부분 취소(환불 분개) → 구매 확정 → PG 대사(입금 분개) → 정산 배치(기간이 닫힌 날) → PAID + 지급 분개.
 * order·payment 가 낸 이벤트는 실제 아웃박스 릴레이·Kafka·settlement 컨슈머를 거친다(대체 없음).
 *
 * 판정은 settlement_db 행이다: 원장 분개(계정별 차 − 대), 정산서·정산서 줄, 정산 항목. 기대 지급액은 주문 입력값(판매가·수량·수수료율·배송비)에서
 * 스펙 식으로 따로 계산한 값이다.
 */
@EnabledIf(SettlementE2ETest.DockerOrCi::class)
@SpringBootTest(
    classes = [CommerceApplication::class, SagaE2EConfig::class, SettlementE2EConfig::class],
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.main.allow-bean-definition-overriding=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        "outbox.polling.interval-ms=100",
        "order.saga.step-timeout-seconds=5",
        "order.saga.deadline-check-interval-ms=300",
        "order.saga.deadline-initial-delay-ms=0",
        "order.claim.deadline-check-interval-ms=300",
        "order.claim.deadline-initial-delay-ms=0",
        "order.purchase-confirm.initial-delay-ms=3600000",
    ],
)
class SettlementE2ETest(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    private val orderJdbc = JdbcTemplate(ctx.getBean("orderMasterDataSource", DataSource::class.java))
    private val settlementJdbc = JdbcTemplate(ctx.getBean("settlementMasterDataSource", DataSource::class.java))
    private val objectMapper = ctx.getBean(ObjectMapper::class.java)

    private val sellerMember = "settlement-e2e-seller"
    private val sellerRequester = ProductRequester(sellerMember, setOf("ROLE_USER", "ROLE_SELLER"))

    // ---- 원장 조회 (settlement_db 행) ----

    /** 계정(과 판매자)의 차 − 대 */
    private fun balance(account: Account, sellerId: Long? = null): Long = requireNotNull(
        settlementJdbc.queryForObject(
            "SELECT COALESCE(SUM(CASE WHEN side = 'DEBIT' THEN amount ELSE -amount END), 0) FROM ledger_entry " +
                "WHERE account = ? AND (? IS NULL OR seller_id = ?)",
            Long::class.java, account.name, sellerId, sellerId,
        ),
    )

    private fun journalCount(sourceKey: String): Long =
        requireNotNull(settlementJdbc.queryForObject("SELECT COUNT(*) FROM ledger_journal WHERE source_key = ?", Long::class.java, sourceKey))

    /** 거래 하나의 (차 합, 대 합) */
    private fun debitCredit(sourceKey: String): Pair<Long, Long> = settlementJdbc.queryForMap(
        "SELECT COALESCE(SUM(CASE WHEN e.side = 'DEBIT' THEN e.amount ELSE 0 END), 0) AS dr, " +
            "COALESCE(SUM(CASE WHEN e.side = 'CREDIT' THEN e.amount ELSE 0 END), 0) AS cr " +
            "FROM ledger_entry e JOIN ledger_journal j ON j.id = e.journal_id WHERE j.source_key = ?",
        sourceKey,
    ).let { (it["dr"] as Number).toLong() to (it["cr"] as Number).toLong() }

    private fun processed(eventId: String): Boolean = requireNotNull(
        settlementJdbc.queryForObject(
            "SELECT COUNT(*) FROM processed_event WHERE event_id = UUID_TO_BIN(?) AND consumer_group = 'settlement-ledger'",
            Long::class.java, eventId,
        ),
    ) > 0

    // ---- 준비 (유스케이스로) ----

    private fun product(name: String, price: Long, stock: Int): Long {
        val id = ctx.getBean(CreateProductUseCase::class.java)
            .execute(CreateProductUseCase.Command(name = name, price = price.toLong(), stock = stock), sellerRequester).id
        ctx.getBean(ReceiveStockUseCase::class.java).execute(ReceiveStockUseCase.Command(productId = id, warehouseId = 1L, qty = stock))
        awaitUntil("product_view $id") {
            orderJdbc.queryForList("SELECT price FROM product_view WHERE product_id = ?", Long::class.java, id).singleOrNull() == price
        }
        return id
    }

    init {
        var sellerId = 0L
        var mug = 0L
        var coaster = 0L
        var couponDefinitionId = 0L

        Given("준비 — 리스너 할당 · 판매자 승인(수수료 10%, 배송비 3,000, 주간 정산) · 상품 둘 · 플랫폼 쿠폰") {
            Then("판매자 행이 order 읽기 모델과 settlement 판매자 모델에 들어온다") {
                val registry = ctx.getBean(KafkaListenerEndpointRegistry::class.java)
                createTopics(registry.listenerContainers.flatMap { it.containerProperties.topics.orEmpty().toList() }.toSet())
                awaitUntil("리스너 할당", timeoutSeconds = 90) {
                    // DLT 컨테이너(패턴 구독)는 뺀다 — DLT 토픽은 첫 실패 때 생기므로 그 전에는 받을 파티션이 없다
                    registry.listenerContainers.filter { it.isRunning && it.containerProperties.topicPattern == null }
                        .all { !it.assignedPartitions.isNullOrEmpty() }
                }
                val seller = ctx.getBean(ApplySellerUseCase::class.java).execute(
                    ApplySellerUseCase.Command(
                        memberId = sellerMember, businessName = "정산 상점", businessRegistrationNo = "555-66-77777",
                        representativeName = "대표", bankName = "은행", accountNumber = "110-555-666777",
                        shippingFee = 3_000L, settlementCycle = SettlementCycle.WEEKLY,
                    ),
                )
                sellerId = seller.id
                ctx.getBean(ManageSellerUseCase::class.java).approve(ManageSellerUseCase.Approve(seller.id, "1", 1_000, "정산 E2E"))
                awaitUntil("seller_view ${seller.id}") {
                    orderJdbc.queryForList("SELECT member_id FROM seller_view WHERE seller_id = ? AND status = 'ACTIVE'", String::class.java, seller.id)
                        .singleOrNull() == sellerMember
                }
                awaitUntil("product_seller ${seller.id}") {
                    ctx.getBean("productMasterDataSource", DataSource::class.java).let(::JdbcTemplate)
                        .queryForList("SELECT status FROM product_seller WHERE seller_id = ?", String::class.java, seller.id).singleOrNull() == "ACTIVE"
                }
                eventually(10.seconds) {
                    settlementJdbc.queryForMap("SELECT member_id, status, settlement_cycle FROM settlement_seller WHERE seller_id = ?", seller.id)
                        .let { listOf(it["member_id"], it["status"], it["settlement_cycle"]) } shouldBe listOf(sellerMember, "ACTIVE", "WEEKLY")
                }
                mug = product("정산 머그", 12_000L, 10)
                coaster = product("정산 받침", 8_000L, 10)
                couponDefinitionId = ctx.getBean(ManageCouponDefinitionUseCase::class.java).create(
                    ManageCouponDefinitionUseCase.Create(
                        name = "정산 2천원", type = CouponType.FIXED, amount = 2_000L, rateBp = null, maxDiscount = null,
                        minOrderAmount = 0L, validFrom = Instant.now().minusSeconds(3_600), validUntil = Instant.now().plusSeconds(86_400),
                        issueLimit = 100, bearer = CouponBearer.PLATFORM, sellerId = null, actorId = "1",
                    ),
                ).id
            }
        }

        Given("주문(머그 2 + 받침 1, 플랫폼 쿠폰·포인트) → 받침 부분 취소 → 구매 확정 → PG 대사 → 정산 배치") {
            Then("매입·환불·입금·지급 분개가 각각 차 = 대, 정산서 PAID 지급액 = Σ(순매출 + 배송비 − 수수료) = 미지급금 감소분, 환불 라인 없음, 시산표 합 0") {
                val buyer = "settlement-e2e-buyer"
                val userCouponId = ctx.getBean(ClaimCouponUseCase::class.java).claim(buyer, couponDefinitionId).userCouponId
                awaitUntil("user_coupon_view $userCouponId") {
                    orderJdbc.queryForList("SELECT status FROM user_coupon_view WHERE user_coupon_id = ?", String::class.java, userCouponId)
                        .singleOrNull() == "AVAILABLE"
                }
                ctx.getBean(GrantPointsUseCase::class.java).grant(GrantPointsUseCase.Grant(buyer, 1_000L, "1", "정산 E2E"))
                awaitUntil("point_balance_view $buyer") {
                    orderJdbc.queryForList("SELECT balance FROM point_balance_view WHERE member_id = ?", Long::class.java, buyer).singleOrNull() == 1_000L
                }
                val sheet = ctx.getBean(CreateOrderSheetUseCase::class.java).execute(
                    CreateOrderSheetUseCase.Command(
                        buyer, listOf(CreateOrderSheetUseCase.Item(mug, 2), CreateOrderSheetUseCase.Item(coaster, 1)), false, userCouponId, 1_000L,
                    ),
                )
                val orderId = ctx.getBean(PlaceOrderUseCase::class.java).place(PlaceOrderUseCase.Command(buyer, UUID.randomUUID().toString(), sheet.id)).orderId
                awaitUntil("주문 $orderId FULFILLING", timeoutSeconds = 20) {
                    orderJdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String::class.java, orderId) == "FULFILLING"
                }
                val payable = requireNotNull(orderJdbc.queryForObject("SELECT payable_amount FROM orders WHERE id = ?", Long::class.java, orderId))
                val captureKey = "capture:order:$orderId"

                // 1) 매입 분개 — 차 = 대 = N + S (24,000 + 8,000 + 3,000), PG 미수금 = 결제액
                eventually(20.seconds) { journalCount(captureKey) shouldBe 1L }
                debitCredit(captureKey) shouldBe (35_000L to 35_000L)
                balance(Account.PG_RECEIVABLE) shouldBe payable
                balance(Account.SELLER_PAYABLE, sellerId) shouldBe -(24_000L + 8_000L + 3_000L - 2_400L - 800L)

                // 같은 매입 이벤트 재배달(같은 id) · 재발행(새 id) → 거래는 그대로 1건
                val stored = orderJdbc.queryForMap(
                    "SELECT event_id, payload FROM outbox_event WHERE partition_key = ? AND event_type = 'order.order.confirmed'", orderId.toString(),
                )
                val republishedId = UUID.randomUUID().toString()
                val producerFactory = OutboxKafka.producerFactory(kafka.bootstrapServers)
                try {
                    val template = KafkaTemplate(producerFactory)
                    for (eventId in listOf(stored["event_id"] as String, republishedId)) {
                        val payload = (objectMapper.readTree(stored["payload"] as String) as ObjectNode).put("eventId", eventId)
                        template.send("order.order.confirmed", orderId.toString(), objectMapper.writeValueAsString(payload)).get(10, TimeUnit.SECONDS)
                    }
                } finally {
                    producerFactory.reset()
                }
                eventually(20.seconds) { processed(republishedId) shouldBe true }
                journalCount(captureKey) shouldBe 1L

                // 2) 받침 부분 취소(출고 전) → 환불 분개 + 환불 키
                val coasterLine = orderJdbc.queryForMap("SELECT id, line_no FROM order_items WHERE order_id = ? AND product_id = ?", orderId, coaster)
                val coasterItemId = (coasterLine["id"] as Number).toLong()
                val claimId = ctx.getBean(RequestClaimUseCase::class.java).request(buyer, orderId, listOf((coasterLine["line_no"] as Number).toInt()))
                    .single().claimId
                eventually(30.seconds) { journalCount("refund:claim:$claimId") shouldBe 1L }
                debitCredit("refund:claim:$claimId").let { (dr, cr) -> dr shouldBe cr; dr shouldBe 8_000L }
                settlementJdbc.queryForObject("SELECT claim_id FROM settlement_refunded_item WHERE item_key = ?", Long::class.java, "line:$coasterItemId") shouldBe claimId

                // 3) 남은 머그 구매 확정 → 정산 항목(라인 + 판매자 마지막 라인이라 배송비)
                val mugItemId = requireNotNull(
                    orderJdbc.queryForObject("SELECT id FROM order_items WHERE order_id = ? AND product_id = ?", Long::class.java, orderId, mug),
                )
                ctx.getBean(ConfirmPurchaseUseCase::class.java).confirm(buyer, orderId)
                eventually(20.seconds) {
                    settlementJdbc.queryForList("SELECT item_key FROM settlement_item WHERE order_id = ?", String::class.java, orderId).toSet() shouldBe
                        setOf("line:$mugItemId", "shipping:$orderId:$sellerId")
                }

                // 4) PG 대사(오늘 KST) → 입금 분개. 입금 뒤 PG 미수금 = 0
                val today = LocalDate.now(ZoneId.of("Asia/Seoul"))
                ctx.getBean(ReconcilePaymentsUseCase::class.java).reconcile(today).matched shouldBe 1
                val orderNo = requireNotNull(
                    ctx.getBean("paymentMasterDataSource", DataSource::class.java).let(::JdbcTemplate)
                        .queryForObject("SELECT order_no FROM payment WHERE order_id = ?", String::class.java, orderId),
                )
                eventually(20.seconds) { journalCount("pg-deposit:$today:$orderNo") shouldBe 1L }
                debitCredit("pg-deposit:$today:$orderNo").let { (dr, cr) -> dr shouldBe cr }
                balance(Account.PG_RECEIVABLE) shouldBe 0L

                // 5) 정산 배치 — 일주일 뒤(이번 주가 닫힌 날)
                val payableBefore = -balance(Account.SELLER_PAYABLE, sellerId)
                (ctx.getBean("settlementClock") as AdvancingClock).advance(Duration.ofDays(7))
                ctx.getBean(RunSettlementBatchUseCase::class.java).run().paid shouldBe 1

                // 기대 지급액 — 주문 입력값에서 스펙 식으로: 순매출 12,000 × 2 + 배송비 3,000 − 수수료 HALF_UP(24,000 × 1000 / 10000)
                val expectedPayout = 24_000L + 3_000L - 2_400L
                val statement = settlementJdbc.queryForMap("SELECT id, status, payout, payout_reference FROM settlement_statement WHERE seller_id = ?", sellerId)
                val statementId = (statement["id"] as Number).toLong()
                statement["status"] shouldBe "PAID"
                (statement["payout"] as Number).toLong() shouldBe expectedPayout
                statement["payout_reference"] shouldBe "MOCK-PAYOUT-$sellerId-$statementId"
                // 정산서 줄에서 다시 더한 값 · 환불된 받침 라인은 없다
                settlementJdbc.queryForObject(
                    "SELECT SUM(net_sales + shipping_fee - commission) FROM settlement_statement_line WHERE statement_id = ?", Long::class.java, statementId,
                ) shouldBe expectedPayout
                settlementJdbc.queryForList("SELECT item_key FROM settlement_statement_line WHERE statement_id = ?", String::class.java, statementId)
                    .toSet() shouldBe setOf("line:$mugItemId", "shipping:$orderId:$sellerId")
                // 지급 분개 = 판매자 미지급금 감소분 = 정산서 지급액, 지급 뒤 잔액 0
                debitCredit("payout:statement:$statementId") shouldBe (expectedPayout to expectedPayout)
                (payableBefore - (-balance(Account.SELLER_PAYABLE, sellerId))) shouldBe expectedPayout
                balance(Account.SELLER_PAYABLE, sellerId) shouldBe 0L

                // 판매자 포털이 읽는 값 · 시산표
                ctx.getBean(GetStatementsUseCase::class.java).forSeller(sellerMember).single().let {
                    it.status shouldBe StatementStatus.PAID
                    it.payout shouldBe expectedPayout
                }
                val tb = ctx.getBean(GetTrialBalanceUseCase::class.java).trialBalance()
                tb.net shouldBe 0L
                tb.totalDebit shouldBe tb.totalCredit
                settlementJdbc.queryForObject(
                    "SELECT COALESCE(SUM(CASE WHEN side = 'DEBIT' THEN amount ELSE -amount END), 0) FROM ledger_entry", Long::class.java,
                ) shouldBe 0L

                // 같은 날 배치를 다시 돌려도 정산서·지급은 그대로
                ctx.getBean(RunSettlementBatchUseCase::class.java).run().opened shouldBe 0
                journalCount("payout:statement:$statementId") shouldBe 1L
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
                            listOf(
                                "warehouse_db", "fulfillment_db", "order_db", "product_db", "deal_db", "seller_db", "payment_db", "promotion_db",
                                "settlement_db",
                            ).forEach { st.execute("CREATE DATABASE IF NOT EXISTS $it") }
                        }
                    }
                }
        }

        private val kafka: KafkaContainer by lazy {
            KafkaContainer(DockerImageName.parse("apache/kafka:3.8.1")).also { it.start() }
        }

        /** 없는 토픽을 구독한 컨슈머는 메타데이터 갱신까지 할당을 못 받는다 — 흐름이 쓰는 토픽을 컨텍스트보다 먼저 만든다 */
        private val TOPICS = listOf(
            "inventory.command.reserve", "inventory.command.confirm", "inventory.command.release", "inventory.command.restock",
            "inventory.reservation.reserved", "inventory.reservation.failed", "inventory.reservation.confirmed",
            "inventory.reservation.released", "inventory.reservation.restocked", "inventory.reservation.expired",
            "inventory.stock.reserved", "inventory.stock.released", "inventory.stock.confirmed", "inventory.stock.received",
            "inventory.stock.restocked",
            "promotion.command.reserve", "promotion.command.confirm", "promotion.command.cancel", "promotion.command.restore",
            "promotion.hold.reserved", "promotion.hold.failed", "promotion.hold.confirmed", "promotion.hold.cancelled",
            "promotion.hold.expired", "promotion.hold.restored", "promotion.coupon.defined", "promotion.coupon.issued",
            "promotion.point.changed",
            "payment.command.authorize", "payment.command.capture", "payment.command.void", "payment.command.refund",
            "payment.payment.authorized", "payment.payment.failed", "payment.payment.unknown", "payment.payment.captured",
            "payment.payment.voided", "payment.payment.refunded", "payment.reconciliation.settled",
            "fulfillment.command.create", "fulfillment.command.cancel", "fulfillment.order.created", "fulfillment.order.cancelled",
            "fulfillment.order.shipped", "fulfillment.order.delivered", "fulfillment.order.cancel-rejected",
            "product.item.created", "product.item.updated",
            "seller.seller.applied", "seller.seller.approved", "seller.seller.suspended", "seller.seller.reactivated",
            "seller.seller.updated", "order.order.confirmed", "order.claim.refunded", "order.line.purchase-confirmed",
        )

        fun createTopics(topics: Collection<String>) {
            AdminClient.create(mapOf(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG to kafka.bootstrapServers)).use { admin ->
                val missing = topics.toSet() - admin.listTopics().names().get()
                // 구독 중인 컨슈머가 메타데이터 요청으로 먼저 자동 생성할 수 있다 — 이미 있으면 그대로 쓴다
                missing.forEach { topic ->
                    runCatching { admin.createTopics(listOf(NewTopic(topic, 1, 1.toShort()))).all().get(30, TimeUnit.SECONDS) }
                        .onFailure { if (it.cause !is TopicExistsException) throw it }
                }
            }
        }

        /** 준비 단계용 — 판정이 아니라 선행 조건을 기다린다(판정은 Kotest eventually) */
        fun awaitUntil(what: String, timeoutSeconds: Long = 10, condition: () -> Boolean) {
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds)
            while (System.nanoTime() < deadline) {
                if (runCatching(condition).getOrDefault(false)) return
                Thread.sleep(100)
            }
            error("${timeoutSeconds}초 안에 준비되지 않았다: $what")
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val inv = mysql.jdbcUrl
            registry.add("spring.kafka.bootstrap-servers") { kafka.bootstrapServers.also { createTopics(TOPICS) } }
            fun ds(prefix: String, url: String) {
                registry.add("$prefix.jdbc-url") { url }
                registry.add("$prefix.username") { mysql.username }
                registry.add("$prefix.password") { mysql.password }
                registry.add("$prefix.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            for (role in listOf("master", "replica")) {
                ds("spring.datasource.$role", inv)
                for (domain in listOf("warehouse", "fulfillment", "order", "product", "seller", "payment", "promotion", "settlement")) {
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
