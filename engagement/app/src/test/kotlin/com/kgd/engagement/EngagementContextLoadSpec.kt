package com.kgd.engagement

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import com.kgd.ads.application.advertiser.usecase.RegisterAdvertiserUseCase
import com.kgd.ads.application.ledger.usecase.GetWalletUseCase
import com.kgd.ads.application.ledger.usecase.TopUpUseCase
import com.kgd.ads.infrastructure.redis.AdsRedisConnection
import com.kgd.ads.presentation.advertiser.controller.AdvertiserController
import com.kgd.ads.presentation.support.AdsExceptionHandler
import com.kgd.experiment.presentation.controller.ExperimentController
import com.kgd.recommendation.presentation.RecommendationController
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.ApplicationContext
import org.springframework.scheduling.config.TaskManagementConfigUtils
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.web.method.ControllerAdviceBean
import java.time.Duration
import javax.sql.DataSource

/**
 * ADR-0093 — engagement 모듈러 모놀리스 **전체 컨텍스트 로드** 검증.
 *
 * `./gradlew build` 와 단위 테스트는 전부 통과하면서 폴드 결함이 살아 있을 수 있다.
 * 실제 `@SpringBootApplication` 을 띄우는 이 검사가 유일한 방어선이다.
 *
 * 특히 보는 것: **recommendation 의 `clickHouseDataSource` 가 experiment 의 JPA 를 죽이지 않는가.**
 * Spring Boot 의 `DataSourceAutoConfiguration` 은 `@ConditionalOnMissingBean(DataSource)` 이라
 * 그 빈 하나로 back-off 하고, 그러면 MySQL 연결과 리포지토리가 조용히 사라진다.
 * `ExperimentDataSourceConfig` 가 명시로 만들기 때문에 뜨는 것이고, 그 설정을 지우면 이 검사가 죽는다.
 */
private val dockerAvailable: Boolean = EngagementTestContainers.dockerAvailable

@Suppress("unused")
fun engagementDockerAvailable(): Boolean = dockerAvailable

@org.springframework.boot.test.context.SpringBootTest(
    classes = [EngagementApplication::class],
    webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.NONE,
    properties = [
        "spring.kafka.listener.auto-startup=false",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.flyway.enabled=false",
        "management.health.redis.enabled=false",
        "spring.kafka.bootstrap-servers=localhost:9092",
        "ADS_TOKEN_SECRET=${EngagementTestContainers.TEST_TOKEN_SECRET}",
        // 호스트 스케줄링을 켜던 outbox 토글을 끈다 — ads 가 스스로 스케줄링을 켜는지 보기 위해서다.
        "outbox.polling.enabled=false",
        // ClickHouse 는 이 검사에 없다. ClickHouseConfig 가 initializationFailTimeout=-1 로
        // 기동 때 연결을 열지 않기 때문에 뜬다 — 그 설정을 되돌리면 이 검사가 죽는다.
        "recommendation.clickhouse.url=jdbc:clickhouse://localhost:8123/analytics",
    ],
)
@org.junit.jupiter.api.condition.EnabledIf(
    value = "com.kgd.engagement.EngagementContextLoadSpecKt#engagementDockerAvailable",
    disabledReason = "Docker 미연결 — Testcontainers MySQL 사용 불가",
)
class EngagementContextLoadSpec(
    @Autowired private val ctx: ApplicationContext,
    @Autowired @Qualifier("experimentDataSource") private val experimentDs: DataSource,
    @Autowired @Qualifier("clickHouseDataSource") private val clickHouseDs: DataSource,
    @Autowired @Qualifier("adsDataSource") private val adsDs: DataSource,
) : BehaviorSpec({

    Given("engagement 모듈러 모놀리스 (recommendation + experiment 한 JVM)") {
        Then("두 도메인의 빈이 충돌 없이 함께 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf(
                    "experimentDataSource",
                    "experimentEntityManagerFactory",
                    "experimentTransactionManager",
                    "clickHouseDataSource",
                ).forEach { ctx.containsBean(it).shouldBeTrue() }
            }

        // 이름이 아니라 **연결이 실제로 어디로 가는지**를 본다. 빈 존재만 세면
        // 자동 구성 back-off 로 JPA 가 죽은 상태도 통과한다.
        Then("experiment 의 datasource 가 MySQL 이고 ClickHouse 와 다른 연결이다")
            .config(enabledIf = { dockerAvailable }) {
                experimentDs.connection.use { c ->
                    c.metaData.databaseProductName.lowercase().contains("mysql") shouldBe true
                }
                (experimentDs === clickHouseDs) shouldBe false
            }

        Then("experiment 리포지토리가 그 datasource 로 실제 질의를 한다")
            .config(enabledIf = { dockerAvailable }) {
                // 리포지토리 빈이 EMF 에 바인딩돼 동작하는지 — count() 가 돌면 스키마까지 닿은 것이다
                val repo = ctx.getBean(com.kgd.experiment.infrastructure.persistence.ExperimentJpaRepository::class.java)
                (repo.count() >= 0L) shouldBe true
            }
    }

    Given("ads 폴드 (ADR-0098)") {
        Then("ads 의 datasource·EMF·TM 과 유스케이스가 함께 로드된다")
            .config(enabledIf = { dockerAvailable }) {
                listOf("adsDataSource", "adsEntityManagerFactory", "adsTransactionManager", "adsFlyway")
                    .forEach { ctx.containsBean(it).shouldBeTrue() }
                ctx.getBeanNamesForType(RegisterAdvertiserUseCase::class.java).size shouldBe 1
                ctx.getBeanNamesForType(TopUpUseCase::class.java).size shouldBe 1
                ctx.getBeanNamesForType(GetWalletUseCase::class.java).size shouldBe 1
            }

        // 비-primary 도메인의 쓰기는 한정자가 어긋나면 예외 없이 사라진다. 빈 존재가 아니라
        // 충전 뒤 **다시 읽은 잔액**으로 본다. 재조회는 JPA 가 아니라 JDBC 로 ads_db 를 직접 읽는다.
        Then("충전하고 다시 읽은 잔액이 충전액과 같다")
            .config(enabledIf = { dockerAvailable }) {
                val memberId = 910_001L
                val advertiserId = ctx.getBean(RegisterAdvertiserUseCase::class.java)
                    .execute(RegisterAdvertiserUseCase.Command(memberId, "컨텍스트 검사 광고주")).advertiserId
                val topUp = ctx.getBean(TopUpUseCase::class.java)
                topUp.execute(TopUpUseCase.Command(memberId, 5_000_000L, "ctx-topup-1"))
                topUp.execute(TopUpUseCase.Command(memberId, 2_500_000L, "ctx-topup-2"))

                ctx.getBean(GetWalletUseCase::class.java).execute(memberId)?.balanceMicros shouldBe 7_500_000L
                val jdbc = JdbcTemplate(adsDs)
                jdbc.queryForObject(
                    "SELECT balance_micros FROM ad_ledger_account WHERE advertiser_id = ?",
                    Long::class.java,
                    advertiserId,
                ) shouldBe 7_500_000L
                jdbc.queryForObject(
                    "SELECT COALESCE(SUM(e.amount_micros), -1) FROM ad_ledger_entry e " +
                        "JOIN ad_ledger_transaction t ON t.id = e.transaction_id " +
                        "WHERE t.idempotency_key IN ('ctx-topup-1', 'ctx-topup-2')",
                    Long::class.java,
                ) shouldBe 0L
            }

        // ads 는 250ms 타임아웃 연결을 스스로 쥔다. 그것이 빈으로 새어 나가면 Boot 자동 구성이
        // 물러나 recommendation 의 공용 템플릿까지 250ms 로 바뀐다.
        Then("recommendation 이 쓰는 공용 Redis 연결은 ads 의 250ms 타임아웃을 갖지 않는다")
            .config(enabledIf = { dockerAvailable }) {
                val shared = ctx.getBean(StringRedisTemplate::class.java).connectionFactory as LettuceConnectionFactory
                shared.clientConfiguration.commandTimeout shouldNotBe Duration.ofMillis(250)

                val ads = ctx.getBean(AdsRedisConnection::class.java).template
                (ads.connectionFactory as LettuceConnectionFactory).clientConfiguration.commandTimeout shouldBe
                    Duration.ofMillis(250)
                (ads.connectionFactory === shared) shouldBe false
                ads.execute { it.ping() } shouldBe "PONG"
            }

        // MVC 가 예외 처리 advice 를 고를 때 쓰는 판정(ControllerAdviceBean)을 그대로 부른다.
        // ads 의 문구 노출 advice 가 전역이 되면 recommendation·experiment 응답 문구까지 바뀐다.
        Then("ads 의 거절 문구 advice 는 ads 컨트롤러에만 걸리고 공용 핸들러보다 먼저다")
            .config(enabledIf = { dockerAvailable }) {
                val advices = ControllerAdviceBean.findAnnotatedBeans(ctx)
                val ads = advices.single { it.beanType == AdsExceptionHandler::class.java }
                // 공용 핸들러는 common 에 있고 이 모듈의 테스트 클래스패스에 직접 오지 않아 이름으로 찾는다
                val global = advices.single { it.beanType?.name == "com.kgd.common.exception.GlobalExceptionHandler" }

                ads.isApplicableToBeanType(AdvertiserController::class.java) shouldBe true
                ads.isApplicableToBeanType(ExperimentController::class.java) shouldBe false
                ads.isApplicableToBeanType(RecommendationController::class.java) shouldBe false
                global.isApplicableToBeanType(ExperimentController::class.java) shouldBe true
                (advices.indexOf(ads) < advices.indexOf(global)) shouldBe true
            }

        Then("outbox 토글을 꺼도 스케줄링이 켜져 있고 풀 크기는 4 다")
            .config(enabledIf = { dockerAvailable }) {
                ctx.containsBean("adsSchedulingConfig").shouldBeTrue()
                ctx.containsBean(TaskManagementConfigUtils.SCHEDULED_ANNOTATION_PROCESSOR_BEAN_NAME).shouldBeTrue()
                ctx.getBean(ThreadPoolTaskScheduler::class.java).scheduledThreadPoolExecutor.corePoolSize shouldBe 4
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
