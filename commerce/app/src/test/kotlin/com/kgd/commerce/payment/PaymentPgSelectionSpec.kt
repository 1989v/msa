package com.kgd.commerce.payment

import com.kgd.payment.application.payment.usecase.ResolvePaymentUseCase
import com.kgd.payment.infrastructure.pg.mock.MockPgCallRecorder
import com.kgd.payment.infrastructure.pg.mock.MockPgConfig
import com.kgd.payment.infrastructure.pg.toss.TossPgAdapter
import com.kgd.payment.infrastructure.pg.toss.TossPgConfig
import com.kgd.payment.presentation.webhook.controller.TossWebhookController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.StandardEnvironment
import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * PG 선택 — commerce `application.yml` 그대로(환경변수는 지운다) + 결제의 PG 설정·웹훅 컨트롤러 패키지 스캔.
 *
 * 판정 근거는 **컨텍스트가 만든 것**이다: 어떤 빈이 생겼는지, 그 컨텍스트가 등록한 컨트롤러로 웹훅 경로를 불렀을 때의 응답.
 * 조건(`payment.pg`)을 지우면 기본 프로필에서도 웹훅 컨트롤러가 생겨 404 가 200 으로 바뀐다.
 */
class PaymentPgSelectionSpec : BehaviorSpec({

    fun runner(vararg env: Pair<String, String>) = ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration::class.java))
        .withInitializer { ctx ->
            val environment: ConfigurableEnvironment = ctx.environment
            environment.propertySources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME)
            YamlPropertySourceLoader().load("commerce-application", ClassPathResource("application.yml"))
                .forEach(environment.propertySources::addLast)
        }
        .withPropertyValues(*env.map { (k, v) -> "$k=$v" }.toTypedArray())
        .withUserConfiguration(TossPgConfig::class.java, MockPgConfig::class.java, WebhookProbe::class.java)

    /** 컨텍스트가 실제로 만든 컨트롤러만 올린 MockMvc 로 웹훅을 부른다 */
    fun webhookStatus(ctx: ApplicationContext): Int {
        val controllers = ctx.getBeansWithAnnotation(RestController::class.java).values.toTypedArray()
        return MockMvcBuilders.standaloneSetup(*controllers).build()
            .perform(
                MockMvcRequestBuilders.post("/api/v1/payments/webhooks/toss")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"data":{"orderId":"ORD-1-1","status":"DONE","totalAmount":1}}"""),
            ).andReturn().response.status
    }

    fun failureMessages(t: Throwable): String = generateSequence(t) { it.cause }.joinToString(" | ") { it.message.orEmpty() }

    given("기본 프로필 (PAYMENT_PG 미설정 = 모의 PG)") {
        then("토스 키 없이 뜨고, 토스 빈·웹훅 컨트롤러가 없어 웹훅 경로는 404") {
            runner().run { ctx ->
                ctx.startupFailure shouldBe null
                ctx.getBean(MockPgCallRecorder::class.java).shouldNotBeNull()
                ctx.containsBean("paymentTossCircuitBreaker") shouldBe false
                ctx.getBeansOfType(TossPgAdapter::class.java).size shouldBe 0
                ctx.getBeansOfType(TossWebhookController::class.java).size shouldBe 0
                webhookStatus(ctx) shouldBe 404
            }
        }
    }

    given("payment.pg=toss") {
        then("TOSS_SECRET_KEY 가 없으면 기동하지 않는다") {
            runner("PAYMENT_PG" to "toss").run { ctx ->
                failureMessages(ctx.startupFailure.shouldNotBeNull()) shouldContain "TOSS_SECRET_KEY"
            }
        }
        then("키가 비어 있어도 기동하지 않는다") {
            runner("PAYMENT_PG" to "toss", "TOSS_SECRET_KEY" to " ").run { ctx ->
                ctx.startupFailure.shouldNotBeNull()
            }
        }
        then("시크릿 키만 있으면 토스 빈이 생기고 모의 PG 기록기는 없다 — 웹훅은 비밀 없이 매핑돼 주문번호로 재조회한다") {
            runner("PAYMENT_PG" to "toss", "TOSS_SECRET_KEY" to "test_sk").run { ctx ->
                ctx.startupFailure shouldBe null
                ctx.containsBean("paymentTossCircuitBreaker") shouldBe true
                ctx.getBean(TossPgAdapter::class.java).shouldNotBeNull()
                ctx.getBeansOfType(MockPgCallRecorder::class.java).size shouldBe 0
                webhookStatus(ctx) shouldBe 200
                verify(exactly = 1) { ctx.getBean(ResolvePaymentUseCase::class.java).resolveByOrderNo("ORD-1-1") }
            }
        }
    }
}) {
    /** 웹훅 컨트롤러 패키지만 스캔 — 조건 판정은 컨트롤러 자신의 애너테이션이 한다 */
    @Configuration
    @ComponentScan(basePackageClasses = [TossWebhookController::class])
    class WebhookProbe {
        @Bean
        fun resolvePaymentUseCase(): ResolvePaymentUseCase = mockk<ResolvePaymentUseCase>().also {
            every { it.resolveByOrderNo(any()) } returns ResolvePaymentUseCase.ResolveOutcome.STILL_PENDING
        }

        @Bean
        fun objectMapper(): ObjectMapper = jacksonMapperBuilder().build()

        /** standaloneSetup 은 컨트롤러가 하나는 있어야 한다 — 기본 프로필에서도 404 판정이 가능하게 */
        @Bean
        fun probeController() = ProbeController()
    }

    @RestController
    class ProbeController {
        @GetMapping("/probe")
        fun probe() = "ok"
    }
}
