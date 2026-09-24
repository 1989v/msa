package com.kgd.inventory

import com.kgd.commerce.CommerceApplication
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
 * ADR-0058 — commerce 모듈러 모놀리스 **전체 컨텍스트 로드** 검증.
 *
 * inventory + warehouse + fulfillment + order + product 도메인 feature 를 한 JVM(InventoryApplication→commerce)에
 * 컴포넌트 스캔으로 띄워, ① 빈 이름 충돌이 없고 ② 도메인별 EMF/TM + 전용 outbox/idempotency 가
 * 각자 datasource/TM 에 바인딩되어 로드되는지 확인한다. 컨텍스트가 뜨면 cross-domain 빈 충돌이
 * 모두 해소됐다는 의미(Spring 은 default 로 bean override 비활성 → 충돌 시 로드 실패).
 *
 * Kafka 리스너는 auto-startup=false, ddl-auto=create(Flyway off) 로 외부 인프라 없이 로드.
 */
private val dockerAvailable: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun commerceDockerAvailable(): Boolean = dockerAvailable

/** 테스트 전용 32바이트 hex 키 — 운영 키와 무관 */
const val TEST_SELLER_ACCOUNT_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"

@org.springframework.boot.test.context.SpringBootTest(
    classes = [CommerceApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        "outbox.polling.enabled=false",
        // product 는 전용 Flyway 를 갖는다 — 호스트 토글로는 안 꺼진다.
        "product.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "spring.kafka.bootstrap-servers=localhost:9092",
        // 도메인별 cleanup 스케줄러가 다중 port 로 모호하지 않은지(k8s 경로) 검증.
        "kgd.common.messaging.idempotent.cleanup.enabled=true",
        // 판매자 계좌 키 — 운영 설정 파일엔 기본값이 없어 테스트가 직접 준다(없으면 기동 실패가 정상).
        "seller.account.enc-key=$TEST_SELLER_ACCOUNT_KEY",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.inventory.CommerceContextLoadSpecKt#commerceDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class CommerceContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
) : BehaviorSpec({

    Given("commerce 모듈러 모놀리스 (inventory + warehouse + fulfillment + order + product + deal 한 JVM)") {
        Then("3 도메인 EMF/TM + 전용 outbox/idempotency 가 충돌 없이 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                // 3 persistence units (도메인별 datasource 격리)
                listOf(
                    "inventoryEntityManagerFactory", "inventoryTransactionManager",
                    "warehouseEntityManagerFactory", "warehouseTransactionManager",
                    "fulfillmentEntityManagerFactory", "fulfillmentTransactionManager",
                    "orderEntityManagerFactory", "orderTransactionManager",
                    // ADR-0093 — product 폴드. 독립 앱 시절 총칭 이름(dataSource·jpaQueryFactory)이
                    // inventory 것과 정면 충돌해 컨텍스트가 안 떴다 — 전부 product* 로 스코프했다.
                    "productEntityManagerFactory", "productTransactionManager",
                    "productJpaQueryFactory",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }

                // 도메인별 전용 outbox/idempotency (각자 TM 바인딩)
                ctx.containsBean("fulfillmentOutboxPort").shouldBeTrue()
                ctx.containsBean("fulfillmentOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("fulfillmentIdempotentEventHandler").shouldBeTrue()
                ctx.containsBean("orderOutboxPort").shouldBeTrue()
                ctx.containsBean("orderOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("orderIdempotentEventHandler").shouldBeTrue()
                ctx.containsBean("inventoryOutboxPort").shouldBeTrue()
                ctx.containsBean("inventoryOutboxPollingPublisher").shouldBeTrue()
                ctx.containsBean("inventoryIdempotentEventHandler").shouldBeTrue()
                ctx.containsBean("productOutboxPort").shouldBeTrue()
                ctx.containsBean("productOutboxPollingPublisher").shouldBeTrue()
                // 도메인별 retention cleanup 스케줄러 (common 단일 스케줄러의 다중-port 모호성 회피)
                ctx.containsBean("inventoryIdempotentEventCleanupScheduler").shouldBeTrue()
                ctx.containsBean("fulfillmentIdempotentEventCleanupScheduler").shouldBeTrue()
                ctx.containsBean("orderIdempotentEventCleanupScheduler").shouldBeTrue()

                // ADR-0093 ② — deal 전용 스키마(deal_db). 조건부 설정이라 키가 없으면
                // 통째로 안 켜지고 리포지토리가 호스트 EMF 로 붙는다 — 그 상태를 잡는다.
                listOf(
                    "dealDataSource", "dealEntityManagerFactory",
                    "dealTransactionManager", "dealFlyway",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }

                // ADR-0099 — seller 전용 스키마(seller_db) + 전용 outbox/idempotency
                listOf(
                    "sellerEntityManagerFactory", "sellerTransactionManager", "sellerFlyway",
                    "sellerOutboxPort", "sellerOutboxPollingPublisher", "sellerIdempotentEventHandler",
                    "sellerIdempotentEventCleanupScheduler",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
                // scanBasePackages 에서 com.kgd.seller 가 빠지면 기동은 되고 판매자 API 만 조용히 404 다
                ctx.getBeansOfType(com.kgd.seller.presentation.seller.controller.SellerController::class.java).size shouldBe 1
                ctx.getBeansOfType(com.kgd.seller.presentation.seller.controller.SellerAdminController::class.java).size shouldBe 1
            }

        /**
         * seller 쓰기·읽기를 seller TM 으로 — 신청 → 승인 → 판매자 포털 조회.
         * 값으로 판정한다: 행이 실제로 남았는지, 계좌 컬럼이 암호문인지, 아웃박스 행이 생겼는지.
         */
        Then("판매자: 신청·승인이 seller_db 에 행을 쓰고 읽으며 seller.seller.approved 아웃박스 행을 남긴다")
            .config(enabledIf = { dockerAvailable }) {
                val jdbc = org.springframework.jdbc.core.JdbcTemplate(
                    ctx.getBean("sellerMasterDataSource", javax.sql.DataSource::class.java),
                )
                // 풀 크기는 설정이 아니라 실제 HikariDataSource 값으로 본다 (hikari. 하위 키는 먹지 않는다)
                (ctx.getBean("sellerMasterDataSource") as com.zaxxer.hikari.HikariDataSource).maximumPoolSize shouldBe 3

                // V1 시드 — 플랫폼 기본 판매자
                jdbc.queryForMap("SELECT member_id, status, commission_rate_bp FROM seller WHERE id = 1").let {
                    it["member_id"] shouldBe "platform"
                    it["status"] shouldBe "ACTIVE"
                    it["commission_rate_bp"] shouldBe 0
                }

                val apply = ctx.getBean(com.kgd.seller.application.seller.usecase.ApplySellerUseCase::class.java)
                val manage = ctx.getBean(com.kgd.seller.application.seller.usecase.ManageSellerUseCase::class.java)
                val me = ctx.getBean(com.kgd.seller.application.seller.usecase.GetMySellerUseCase::class.java)
                val outbox = ctx.getBean(com.kgd.seller.infrastructure.outbox.SellerOutboxRepository::class.java)
                val command = com.kgd.seller.application.seller.usecase.ApplySellerUseCase.Command(
                    memberId = "ctx-9001",
                    businessName = "컨텍스트 상점",
                    businessRegistrationNo = "123-45-67890",
                    representativeName = "대표",
                    bankName = "은행",
                    accountNumber = "110-123-456789",
                    shippingFee = 3000L,
                    settlementCycle = com.kgd.seller.domain.seller.model.SettlementCycle.WEEKLY,
                )

                val applied = apply.execute(command)
                manage.approve(
                    com.kgd.seller.application.seller.usecase.ManageSellerUseCase.Approve(
                        sellerId = applied.id, actorId = "1", commissionRateBp = 1200, reason = "컨텍스트 검사",
                    ),
                )

                // 읽기 — 커밋된 행을 다시 읽어 ACTIVE 로 본다
                me.execute("ctx-9001").let {
                    it.id shouldBe applied.id
                    it.status shouldBe com.kgd.seller.domain.seller.model.SellerStatus.ACTIVE
                    it.commissionRateBp shouldBe 1200
                }
                // 계좌 컬럼에 평문이 없다
                jdbc.queryForMap(
                    "SELECT account_number_enc, account_number_masked, account_key_version FROM seller WHERE id = ?",
                    applied.id,
                ).let {
                    (it["account_number_enc"] as String).contains("110123456789") shouldBe false
                    it["account_number_masked"] shouldBe "********6789"
                    it["account_key_version"] shouldBe 1
                }
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM seller_admin_action WHERE seller_id = ? AND action = 'APPROVE' AND actor_id = '1'",
                    Long::class.java, applied.id,
                ) shouldBe 1L

                val rows = outbox.findAll().filter { it.aggregateId == applied.id }
                rows.map { it.eventType }.toSet() shouldBe setOf("seller.seller.applied", "seller.seller.approved")
                rows.forEach {
                    it.partitionKey shouldBe applied.id.toString()
                    it.payload.contains("110123456789") shouldBe false
                    it.payload.contains("1234567890") shouldBe false
                }

                // 1인 1판매자 — 서비스를 거치지 않은 동시 INSERT 도 DB 유니크 제약이 막는다
                io.kotest.assertions.throwables.shouldThrow<org.springframework.dao.DataIntegrityViolationException> {
                    jdbc.update(
                        "INSERT INTO seller (member_id, status, business_name, shipping_fee, settlement_cycle, " +
                            "applied_at, updated_at) VALUES ('ctx-9001', 'PENDING', 'dup', 0, 'WEEKLY', NOW(6), NOW(6))",
                    )
                }
            }

        /**
         * 주문 접수·사가 시작·멱등 키 정리를 order TM 으로. 값으로 판정한다: order_db 의 주문·사가·멱등 키·아웃박스 행,
         * 그리고 `@Modifying` 삭제(멱등 키 정리)가 실제로 행을 지웠는지 — 한정자가 어긋나면 예외 없이 0 이 된다.
         */
        Then("주문: 주문서로 접수 → 주문·사가·멱등 키·재고 예약 명령 행, 오래된 멱등 키 정리")
            .config(enabledIf = { dockerAvailable }) {
                val tx = org.springframework.transaction.support.TransactionTemplate(
                    ctx.getBean("orderTransactionManager", org.springframework.transaction.PlatformTransactionManager::class.java),
                )
                val jdbc = org.springframework.jdbc.core.JdbcTemplate(
                    ctx.getBean("orderMasterDataSource", javax.sql.DataSource::class.java),
                )
                val sheets = ctx.getBean(com.kgd.order.application.sheet.port.OrderSheetRepositoryPort::class.java)
                val sheetId = requireNotNull(
                    tx.execute {
                        sheets.save(
                            com.kgd.order.domain.sheet.model.OrderSheet.create(
                                memberId = "ctx-order",
                                lines = listOf(
                                    com.kgd.order.domain.sheet.model.OrderSheetLine(1, 9101L, "컨텍스트 상품", 1L, 7_000L, 1, 0, null, 0, 0),
                                ),
                                shippingLines = listOf(com.kgd.order.domain.sheet.model.ShippingLine(1L, 0L)),
                                userCouponId = null, couponDefinitionId = null,
                                expiresAt = java.time.Instant.now().plusSeconds(900), createdAt = java.time.Instant.now(),
                            ),
                        ).id
                    },
                )
                val place = ctx.getBean(com.kgd.order.application.order.usecase.PlaceOrderUseCase::class.java)
                val accepted = place.place(com.kgd.order.application.order.usecase.PlaceOrderUseCase.Command("ctx-order", "ctx-key", sheetId))

                jdbc.queryForObject("SELECT status FROM orders WHERE id = ?", String::class.java, accepted.orderId) shouldBe "CREATED"
                jdbc.queryForObject("SELECT step FROM order_saga WHERE order_id = ?", String::class.java, accepted.orderId) shouldBe
                    "INVENTORY_RESERVE"
                jdbc.queryForObject(
                    "SELECT status FROM idempotency_key WHERE user_id = 'ctx-order' AND idem_key = 'ctx-key'", String::class.java,
                ) shouldBe "COMPLETED"
                jdbc.queryForObject(
                    "SELECT partition_key FROM outbox_event WHERE event_type = 'inventory.command.reserve' AND aggregate_id = ?",
                    String::class.java, accepted.orderId,
                ) shouldBe accepted.orderId.toString()

                jdbc.update(
                    "INSERT INTO idempotency_key (user_id, idem_key, status, lease_until, created_at) " +
                        "VALUES ('ctx-order', 'old-key', 'COMPLETED', NOW(6), NOW(6) - INTERVAL 2 DAY)",
                )
                ctx.getBean(com.kgd.order.application.order.usecase.CleanupIdempotencyKeysUseCase::class.java).cleanup() shouldBe 1
                jdbc.queryForObject("SELECT COUNT(*) FROM idempotency_key WHERE idem_key = 'old-key'", Long::class.java) shouldBe 0L
            }

        /**
         * 결제 쓰기·읽기를 payment TM 으로 — 기본 프로필(모의 PG)에서 승인 → 매입 → 대사.
         * 값으로 판정한다: 모의 PG 가 받은 승인 호출 수, payment_db 행, 아웃박스 행의 키, settled 행.
         */
        Then("결제: 같은 orderNo 승인 두 번 → 모의 PG 승인 1회, payment_db 행 쓰기·읽기, 키 = orderId, 대사 settled")
            .config(enabledIf = { dockerAvailable }) {
                (ctx.getBean("paymentMasterDataSource") as com.zaxxer.hikari.HikariDataSource).maximumPoolSize shouldBe 3
                listOf(
                    "paymentEntityManagerFactory", "paymentTransactionManager", "paymentFlyway",
                    "paymentOutboxPort", "paymentOutboxPollingPublisher", "paymentIdempotentEventHandler",
                    "paymentIdempotentEventCleanupScheduler", "paymentKafkaListenerContainerFactory",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
                ctx.getBeansOfType(
                    com.kgd.payment.presentation.opsissue.controller.PaymentOpsIssueAdminController::class.java,
                ).size shouldBe 1

                // 기본 프로필 = 모의 PG. 토스 빈은 하나도 없고 웹훅 컨트롤러도 없다(경로 404)
                ctx.getBean(com.kgd.payment.application.payment.port.PgPort::class.java)::class shouldBe
                    com.kgd.payment.infrastructure.pg.mock.MockPgAdapter::class
                ctx.containsBean("paymentTossCircuitBreaker") shouldBe false
                ctx.getBeansOfType(com.kgd.payment.infrastructure.pg.toss.TossPgAdapter::class.java).size shouldBe 0
                ctx.getBeansOfType(
                    com.kgd.payment.presentation.webhook.controller.TossWebhookController::class.java,
                ).size shouldBe 0

                val commands = ctx.getBean(com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase::class.java)
                val recorder = ctx.getBean(com.kgd.payment.infrastructure.pg.mock.MockPgCallRecorder::class.java)
                val outbox = ctx.getBean(com.kgd.payment.infrastructure.outbox.PaymentOutboxRepository::class.java)
                val jdbc = org.springframework.jdbc.core.JdbcTemplate(
                    ctx.getBean("paymentMasterDataSource", javax.sql.DataSource::class.java),
                )
                val command = com.kgd.payment.application.payment.usecase.ProcessPaymentCommandUseCase.Authorize(
                    orderId = 880001L, orderNo = "CTX-880001-1", amount = 12_000L,
                )

                val first = commands.authorize(command)
                commands.authorize(command).id shouldBe first.id
                recorder.count(com.kgd.payment.infrastructure.pg.mock.MockPgCallRecorder.Op.AUTHORIZE, "CTX-880001-1") shouldBe 1

                jdbc.queryForMap("SELECT status, payment_key, amount FROM payment WHERE order_no = 'CTX-880001-1'").let {
                    it["status"] shouldBe "AUTHORIZED"
                    it["payment_key"] shouldBe "mock-CTX-880001-1"
                    it["amount"] shouldBe 12_000L
                }
                jdbc.queryForObject("SELECT COUNT(*) FROM payment WHERE order_no = 'CTX-880001-1'", Long::class.java) shouldBe 1L

                commands.capture("CTX-880001-1").status shouldBe com.kgd.payment.domain.payment.model.PaymentStatus.CAPTURED

                val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"))
                ctx.getBean(com.kgd.payment.application.payment.usecase.ReconcilePaymentsUseCase::class.java)
                    .reconcile(today).matched shouldBe 1

                val rows = outbox.findAll().filter { it.aggregateId == first.id }
                rows.map { it.eventType }.toSet() shouldBe setOf(
                    "payment.payment.authorized", "payment.payment.captured", "payment.reconciliation.settled",
                )
                rows.forEach { it.partitionKey shouldBe "880001" }
                // 모의 PG 수수료 2% — 12,000원 → 240원, 입금 11,760원
                ctx.getBean(tools.jackson.databind.ObjectMapper::class.java)
                    .readTree(rows.single { it.eventType == "payment.reconciliation.settled" }.payload).let {
                        it["grossAmount"].asLong() shouldBe 12_000L
                        it["pgFee"].asLong() shouldBe 240L
                        it["depositAmount"].asLong() shouldBe 11_760L
                    }
            }

        /**
         * 혜택 쓰기·읽기를 promotion TM 으로 — 정의 → 받기 → 포인트 지급 → 보류 → 확정.
         * 값으로 판정한다: promotion_db 행, 아웃박스 행의 토픽·키. (발행 상한 동시성·만료는 PromotionIntegrationSpec)
         */
        Then("혜택: 쿠폰 받기·포인트·보류·확정이 promotion_db 에 쓰이고 읽히며, 아웃박스 키가 계약대로다")
            .config(enabledIf = { dockerAvailable }) {
                (ctx.getBean("promotionMasterDataSource") as com.zaxxer.hikari.HikariDataSource).maximumPoolSize shouldBe 3
                listOf(
                    "promotionEntityManagerFactory", "promotionTransactionManager", "promotionFlyway",
                    "promotionOutboxPort", "promotionOutboxPollingPublisher", "promotionIdempotentEventHandler",
                    "promotionIdempotentEventCleanupScheduler", "promotionKafkaListenerContainerFactory",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
                // scanBasePackages 에서 com.kgd.promotion 이 빠지면 기동은 되고 혜택 API 만 조용히 404 다
                listOf(
                    com.kgd.promotion.presentation.coupon.controller.CouponController::class.java,
                    com.kgd.promotion.presentation.coupon.controller.CouponAdminController::class.java,
                    com.kgd.promotion.presentation.point.controller.PointController::class.java,
                ).forEach { ctx.getBeansOfType(it).size shouldBe 1 }

                val now = java.time.Instant.now()
                val definition = ctx.getBean(com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase::class.java)
                    .create(
                        com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase.Create(
                            name = "컨텍스트 쿠폰", type = com.kgd.promotion.domain.coupon.model.CouponType.FIXED, amount = 2_000L,
                            rateBp = null, maxDiscount = null, minOrderAmount = 10_000L, validFrom = now.minusSeconds(3600),
                            validUntil = now.plusSeconds(86_400), issueLimit = 5,
                            bearer = com.kgd.promotion.domain.coupon.model.CouponBearer.PLATFORM, sellerId = null, actorId = "1",
                        ),
                    )
                val coupon = ctx.getBean(com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase::class.java)
                    .claim("ctx-member", definition.id)
                ctx.getBean(com.kgd.promotion.application.point.usecase.GrantPointsUseCase::class.java).grant(
                    com.kgd.promotion.application.point.usecase.GrantPointsUseCase.Grant("ctx-member", 5_000L, "1", "컨텍스트 검사"),
                )
                val commands = ctx.getBean(com.kgd.promotion.application.hold.usecase.ProcessPromotionCommandUseCase::class.java)
                commands.reserve(
                    com.kgd.promotion.application.hold.usecase.ProcessPromotionCommandUseCase.Reserve(
                        orderId = 660001L, memberId = "ctx-member", userCouponId = coupon.userCouponId, couponDiscount = 2_000L,
                        pointAmount = 1_500L, lines = listOf(com.kgd.promotion.domain.coupon.model.CouponLine(1L, 12_000L)),
                    ),
                ).type shouldBe com.kgd.promotion.application.hold.port.HoldEventType.RESERVED
                commands.confirm(660001L).type shouldBe com.kgd.promotion.application.hold.port.HoldEventType.CONFIRMED

                // 읽기 — 커밋된 행을 유스케이스로 다시 읽는다
                ctx.getBean(com.kgd.promotion.application.coupon.usecase.GetMyCouponsUseCase::class.java).list("ctx-member")
                    .single().status shouldBe com.kgd.promotion.domain.coupon.model.UserCouponStatus.USED
                ctx.getBean(com.kgd.promotion.application.point.usecase.GetMyPointsUseCase::class.java).get("ctx-member")
                    .balance shouldBe 3_500L

                val jdbc = org.springframework.jdbc.core.JdbcTemplate(
                    ctx.getBean("promotionMasterDataSource", javax.sql.DataSource::class.java),
                )
                jdbc.queryForMap("SELECT status, coupon_discount, point_amount FROM promotion_hold WHERE order_id = 660001").let {
                    it["status"] shouldBe "CONFIRMED"
                    it["coupon_discount"] shouldBe 2_000L
                    it["point_amount"] shouldBe 1_500L
                }
                jdbc.queryForObject("SELECT issued_count FROM coupon_definition WHERE id = ?", Int::class.java, definition.id) shouldBe 1

                val rows = ctx.getBean(com.kgd.promotion.infrastructure.outbox.PromotionOutboxRepository::class.java).findAll()
                rows.single { it.eventType == "promotion.coupon.defined" }.partitionKey shouldBe definition.id.toString()
                rows.single { it.eventType == "promotion.coupon.issued" }.partitionKey shouldBe "ctx-member"
                rows.filter { it.eventType == "promotion.point.changed" }.map { it.partitionKey }.toSet() shouldBe setOf("ctx-member")
                rows.filter { it.eventType.startsWith("promotion.hold.") }.map { it.eventType to it.partitionKey }.toSet() shouldBe setOf(
                    "promotion.hold.reserved" to "660001", "promotion.hold.confirmed" to "660001",
                )
            }

        // 상품 이벤트는 직접 send 가 아니라 product_db 아웃박스 행이다 — 행이 실제로 늘었는지로 판정한다.
        /**
         * 원장·정산 쓰기·읽기를 settlement TM 으로 — 판매자 → 매입 거래 → 구매 확정 항목 → 배치(PAID + 지급 거래) → 조회.
         * 값으로 판정한다: settlement_db 행, 유스케이스가 다시 읽은 정산서·시산표. (실 Kafka 경로는 SettlementE2ETest)
         */
        Then("정산: 매입 거래·정산 항목·정산서·지급 거래가 settlement_db 에 쓰이고 읽히며, 시산표 합이 0 이다")
            .config(enabledIf = { dockerAvailable }) {
                (ctx.getBean("settlementMasterDataSource") as com.zaxxer.hikari.HikariDataSource).maximumPoolSize shouldBe 3
                listOf(
                    "settlementEntityManagerFactory", "settlementTransactionManager", "settlementFlyway",
                    "settlementIdempotentEventHandler", "settlementIdempotentEventCleanupScheduler",
                    "settlementKafkaListenerContainerFactory", "settlementDltKafkaTemplate",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
                // scanBasePackages 에서 com.kgd.settlement 가 빠지면 기동은 되고 정산 API 만 조용히 404 다
                listOf(
                    com.kgd.settlement.presentation.statement.controller.SellerSettlementController::class.java,
                    com.kgd.settlement.presentation.statement.controller.SettlementAdminController::class.java,
                    com.kgd.settlement.presentation.ledger.controller.LedgerAdminController::class.java,
                ).forEach { ctx.getBeansOfType(it).size shouldBe 1 }

                val confirmedAt = java.time.Instant.parse("2026-01-07T03:00:00Z") // 오래전 주 — 오늘 배치에서 이미 닫힌 기간
                ctx.getBean(com.kgd.settlement.application.seller.usecase.SyncSettlementSellerUseCase::class.java).sync(
                    com.kgd.settlement.domain.seller.model.SettlementSeller(
                        880L, "ctx-settlement-member", "ACTIVE", com.kgd.settlement.domain.statement.model.SettlementCycle.WEEKLY, confirmedAt,
                    ),
                )
                val line = com.kgd.settlement.domain.ledger.model.LineAmounts(88_001L, 880L, 10_000L, 1_000L, 0L, 0L)
                val ledger = ctx.getBean(com.kgd.settlement.application.ledger.usecase.RecordLedgerUseCase::class.java)
                val capture = com.kgd.settlement.application.ledger.usecase.RecordLedgerUseCase.Capture(
                    880_001L, 10_000L, listOf(line), emptyList(), confirmedAt, java.util.UUID.randomUUID().toString(),
                )
                ledger.recordCapture(capture) shouldBe true
                ledger.recordCapture(capture) shouldBe false
                ctx.getBean(com.kgd.settlement.application.statement.usecase.RegisterSettlementItemUseCase::class.java).register(
                    com.kgd.settlement.application.statement.usecase.RegisterSettlementItemUseCase.PurchaseConfirmed(880_001L, line, null, confirmedAt),
                )
                ctx.getBean(com.kgd.settlement.application.statement.usecase.RunSettlementBatchUseCase::class.java).run().paid shouldBe 1

                // 읽기 — 커밋된 행을 유스케이스로 다시 읽는다
                val statement = ctx.getBean(com.kgd.settlement.application.statement.usecase.GetStatementsUseCase::class.java)
                    .forSeller("ctx-settlement-member").single()
                statement.status shouldBe com.kgd.settlement.domain.statement.model.StatementStatus.PAID
                statement.payout shouldBe 9_000L
                statement.lines.single().key shouldBe "line:88001"
                val tb = ctx.getBean(com.kgd.settlement.application.ledger.usecase.GetTrialBalanceUseCase::class.java).trialBalance()
                tb.net shouldBe 0L
                tb.sellerPayables.single { it.sellerId == 880L }.balance shouldBe 0L

                val jdbc = org.springframework.jdbc.core.JdbcTemplate(
                    ctx.getBean("settlementMasterDataSource", javax.sql.DataSource::class.java),
                )
                jdbc.queryForList("SELECT type FROM ledger_journal WHERE order_id = 880001 OR source_key LIKE 'payout:%' ORDER BY id", String::class.java) shouldBe
                    listOf("CAPTURE", "PAYOUT")
                jdbc.queryForMap("SELECT status, payout FROM settlement_statement WHERE seller_id = 880").let {
                    it["status"] shouldBe "PAID"
                    it["payout"] shouldBe 9_000L
                }
                jdbc.queryForObject("SELECT statement_id FROM settlement_item WHERE item_key = 'line:88001'", Long::class.java) shouldBe statement.id
            }

        Then("상품 등록이 product_db 아웃박스에 product.item.created 행을 남긴다")
            .config(enabledIf = { dockerAvailable }) {
                val outbox = ctx.getBean(com.kgd.product.infrastructure.outbox.ProductOutboxRepository::class.java)
                val before = outbox.findAll().count { it.eventType == "product.item.created" }

                ctx.getBean(com.kgd.product.application.product.usecase.CreateProductUseCase::class.java).execute(
                    com.kgd.product.application.product.usecase.CreateProductUseCase.Command(
                        name = "outbox-probe", price = 1000L, stock = 0,
                    ),
                    com.kgd.product.application.product.usecase.ProductRequester("1", setOf("ROLE_ADMIN")),
                )

                outbox.findAll().count { it.eventType == "product.item.created" } shouldBe before + 1
            }

        // 주문 단위 예약을 실제 MySQL 로 — FOR UPDATE 잠금 쿼리가 돌고, 모자란 라인이 있으면 행이 하나도 안 남는다.
        Then("주문 예약: 두 라인 중 한 라인이 모자라면 예약 0행 + inventory.reservation.failed 1행")
            .config(enabledIf = { dockerAvailable }) {
                // 도메인 모델은 이 모듈 테스트 클래스패스에 없어 JPA 저장소로 시드·조회한다.
                val inventories = ctx.getBean(
                    com.kgd.inventory.infrastructure.persistence.inventory.repository.InventoryJpaRepository::class.java,
                )
                val reservations = ctx.getBean(
                    com.kgd.inventory.infrastructure.persistence.reservation.repository.ReservationJpaRepository::class.java,
                )
                val outbox = ctx.getBean(com.kgd.inventory.infrastructure.outbox.InventoryOutboxRepository::class.java)
                val reserve = ctx.getBean(
                    com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase::class.java,
                )
                fun seed(productId: Long, qty: Int) = inventories.save(
                    com.kgd.inventory.infrastructure.persistence.inventory.entity.InventoryJpaEntity(
                        productId = productId, warehouseId = 1L, availableQty = qty, reservedQty = 0,
                    ),
                )
                seed(9001L, 10)
                seed(9002L, 1)
                fun available(productId: Long) = inventories.findByProductIdAndWarehouseId(productId, 1L)!!.availableQty
                fun line(productId: Long, qty: Int) =
                    com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase.Line(productId, qty)

                val failed = reserve.execute(
                    com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase.Command(
                        orderId = 990001L, lines = listOf(line(9001L, 3), line(9002L, 5)),
                    ),
                )
                (failed is com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase.Result.Failed)
                    .shouldBeTrue()
                reservations.findAllByOrderId(990001L).size shouldBe 0
                available(9001L) shouldBe 10
                outbox.findAll().count {
                    it.eventType == "inventory.reservation.failed" && it.partitionKey == "990001"
                } shouldBe 1

                val reserved = reserve.execute(
                    com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase.Command(
                        orderId = 990002L, lines = listOf(line(9001L, 3)),
                    ),
                )
                (reserved is com.kgd.inventory.application.inventory.usecase.ReserveOrderStockUseCase.Result.Reserved)
                    .shouldBeTrue()
                reservations.findAllByOrderId(990002L).size shouldBe 1
                available(9001L) shouldBe 7
            }

        /**
         * ADR-0058 불변식 — 폴드된 도메인의 `@Transactional` 은 **자기 TM 을 한정자로 지정**해야 한다.
         *
         * 빈 존재만 세면 이 결함을 못 잡는다. 한정자가 없으면 primary(inventory) TM 에 붙고,
         * deal EM 이 트랜잭션에 참여하지 않아 `@Modifying` UPDATE 가 조용히 실패한다.
         * 그리고 `RecordDealClickUseCase` 의 호출부는 그 실패를 **의도적으로 삼킨다**(리다이렉트가
         * 본질이라서) — 그래서 로그에도 안 남고 클릭 수만 안 오른다.
         *
         * 2026-09-11 운영에서 실제로 그랬다: 클릭 행은 40→42 로 늘고 click_count 는 8 고정.
         * 그래서 **값으로 판정한다** — 실제로 한 번 올려 보고 1 이 늘었는지 읽는다.
         */
        Then("deal 클릭 수가 실제로 증가한다 — 한정자 없는 @Transactional 이면 조용히 실패한다")
            .config(enabledIf = { dockerAvailable }) {
                val offers = ctx.getBean(
                    com.kgd.deal.infrastructure.persistence.repository.DealOfferJpaRepository::class.java,
                )
                // V1 은 카테고리만 시드한다 — 오퍼는 이 검사가 직접 만든다(자기 완결).
                val saved = offers.save(
                    com.kgd.deal.infrastructure.persistence.entity.DealOfferJpaEntity(
                        slug = "tm-qualifier-probe",
                        categoryId = 1,
                        merchant = "probe",
                        title = "probe",
                        benefit = "probe",
                        targetUrl = "https://example.invalid/probe",
                    ),
                )
                val id = requireNotNull(saved.id)
                val was = offers.findById(id).orElseThrow().clickCount

                ctx.getBean(com.kgd.deal.application.offer.usecase.RecordDealClickUseCase::class.java)
                    .execute(
                        com.kgd.deal.application.offer.usecase.RecordDealClickUseCase.Command(
                            offerId = id, referrer = null, userAgent = null,
                        ),
                    )

                offers.findById(id).orElseThrow().clickCount shouldBe was + 1
            }
    }
}) {

    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val mysql: MySQLContainer<*>? = if (dockerAvailable) {
            MySQLContainer(DockerImageName.parse("mysql:8.0.33"))
                .withDatabaseName("inventory_db")
                .withUsername("root")
                .withPassword("test")
                .also { c ->
                    c.start()
                    c.createConnection("").use { conn ->
                        conn.createStatement().use {
                            it.execute("CREATE DATABASE IF NOT EXISTS warehouse_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS fulfillment_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS order_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS product_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS deal_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS seller_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS payment_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS promotion_db")
                            it.execute("CREATE DATABASE IF NOT EXISTS settlement_db")
                        }
                    }
                }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            if (mysql == null) return
            val inv = mysql.jdbcUrl
            val wh = inv.replace("/inventory_db", "/warehouse_db")
            val ful = inv.replace("/inventory_db", "/fulfillment_db")
            val ord = inv.replace("/inventory_db", "/order_db")
            val prod = inv.replace("/inventory_db", "/product_db")
            val deal = inv.replace("/inventory_db", "/deal_db")
            val seller = inv.replace("/inventory_db", "/seller_db")
            val payment = inv.replace("/inventory_db", "/payment_db")
            val promotion = inv.replace("/inventory_db", "/promotion_db")
            val settlement = inv.replace("/inventory_db", "/settlement_db")
            // inventory (master/replica)
            for (role in listOf("master", "replica")) {
                registry.add("spring.datasource.$role.jdbc-url") { inv }
                registry.add("spring.datasource.$role.username") { mysql.username }
                registry.add("spring.datasource.$role.password") { mysql.password }
                registry.add("spring.datasource.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.warehouse.$role.jdbc-url") { wh }
                registry.add("spring.datasource.warehouse.$role.username") { mysql.username }
                registry.add("spring.datasource.warehouse.$role.password") { mysql.password }
                registry.add("spring.datasource.warehouse.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.fulfillment.$role.jdbc-url") { ful }
                registry.add("spring.datasource.fulfillment.$role.username") { mysql.username }
                registry.add("spring.datasource.fulfillment.$role.password") { mysql.password }
                registry.add("spring.datasource.fulfillment.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.order.$role.jdbc-url") { ord }
                registry.add("spring.datasource.order.$role.username") { mysql.username }
                registry.add("spring.datasource.order.$role.password") { mysql.password }
                registry.add("spring.datasource.order.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.product.$role.jdbc-url") { prod }
                registry.add("spring.datasource.product.$role.username") { mysql.username }
                registry.add("spring.datasource.product.$role.password") { mysql.password }
                registry.add("spring.datasource.product.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.seller.$role.jdbc-url") { seller }
                registry.add("spring.datasource.seller.$role.username") { mysql.username }
                registry.add("spring.datasource.seller.$role.password") { mysql.password }
                registry.add("spring.datasource.seller.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.payment.$role.jdbc-url") { payment }
                registry.add("spring.datasource.payment.$role.username") { mysql.username }
                registry.add("spring.datasource.payment.$role.password") { mysql.password }
                registry.add("spring.datasource.payment.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.promotion.$role.jdbc-url") { promotion }
                registry.add("spring.datasource.promotion.$role.username") { mysql.username }
                registry.add("spring.datasource.promotion.$role.password") { mysql.password }
                registry.add("spring.datasource.promotion.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
                registry.add("spring.datasource.settlement.$role.jdbc-url") { settlement }
                registry.add("spring.datasource.settlement.$role.username") { mysql.username }
                registry.add("spring.datasource.settlement.$role.password") { mysql.password }
                registry.add("spring.datasource.settlement.$role.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
            }
            // deal 은 master/replica 가 아니라 단일 url 이다 — 읽기 복제본이 없다.
            // 이 키가 있어야 DealDataSourceConfig(@ConditionalOnProperty)가 켜진다.
            registry.add("spring.datasource.deal.url") { deal }
            registry.add("spring.datasource.deal.username") { mysql.username }
            registry.add("spring.datasource.deal.password") { mysql.password }
            registry.add("spring.datasource.deal.driver-class-name") { "com.mysql.cj.jdbc.Driver" }
        }
    }
}
