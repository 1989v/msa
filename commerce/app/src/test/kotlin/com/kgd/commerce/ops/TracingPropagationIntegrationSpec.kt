package com.kgd.commerce.ops

import com.kgd.commerce.CommerceApplication
import io.kotest.core.annotation.EnabledIf
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.micrometer.core.instrument.MeterRegistry
import com.kgd.order.infrastructure.metrics.OrderSagaMetrics
import com.kgd.payment.infrastructure.metrics.PaymentOpsMetrics
import com.kgd.settlement.infrastructure.metrics.SettlementOpsMetrics
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.slf4j.MDC
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.kafka.config.KafkaListenerEndpointRegistry
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import javax.sql.DataSource

/**
 * HTTP 요청의 traceId 가 아웃박스 행 → 릴레이 → Kafka → 리스너까지 이어지는가. 실제 MySQL + 실제 Kafka + 실제 HTTP.
 *
 * 판정은 **리스너 스레드의 MDC `traceId`** — 요청이 보낸 traceparent 의 traceId 와 같아야 한다. 릴레이는 스케줄러
 * 스레드라 요청 문맥이 없으므로, 행을 쓸 때 헤더를 남기지 않으면 컨슈머는 새 traceId 로 시작한다.
 * 탐침 리스너는 order 의 컨테이너 팩토리를 쓴다 — 도메인 팩토리에 관측이 켜져 있지 않으면 MDC 가 비어 실패한다.
 */
@EnabledIf(OpsDockerOrCi::class)
@SpringBootTest(
    classes = [CommerceApplication::class, TracingPropagationIntegrationSpec.Probe::class],
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "management.health.redis.enabled=false",
        "spring.data.redis.host=localhost",
        "seller.account.enc-key=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
        "outbox.polling.interval-ms=200",
        "promotion.hold-expiry.initial-delay-ms=3600000",
    ],
)
class TracingPropagationIntegrationSpec(
    @Autowired private val ctx: ApplicationContext,
    @Autowired private val env: Environment,
) : BehaviorSpec() {

    override fun extensions() = listOf(SpringExtension)

    /** 리스너가 본 (MDC traceId, 레코드 traceparent) */
    data class Seen(val mdcTraceId: String?, val traceparent: String?)

    @TestConfiguration(proxyBeanMethods = false)
    class Probe {
        @Bean
        fun tracingProbeListener() = ProbeListener()
    }

    class ProbeListener {
        val seen = LinkedBlockingQueue<Seen>()

        @KafkaListener(topics = ["product.item.updated"], groupId = "tracing-probe", containerFactory = "orderKafkaListenerContainerFactory")
        fun on(record: ConsumerRecord<String, String>) {
            seen += Seen(MDC.get("traceId"), record.headers().lastHeader("traceparent")?.value()?.let(::String))
        }
    }

    init {
        val port = env.getRequiredProperty("local.server.port").toInt()
        val probe = ctx.getBean(ProbeListener::class.java)
        val productJdbc = JdbcTemplate(ctx.getBean("productMasterDataSource", DataSource::class.java))

        Given("traceparent 를 단 HTTP 요청이 아웃박스 이벤트를 만든다(상품 재발행)") {
            infra.createTopics("product.item.updated")
            infra.awaitAssigned(ctx.getBean(KafkaListenerEndpointRegistry::class.java), setOf("tracing-probe"))
            productJdbc.update(
                "INSERT INTO products (name, price, price_won, stock, status, created_at, seller_id) VALUES ('추적 확인', 1000, 1000, 1, 'ACTIVE', NOW(), 1)",
            )
            val traceId = "4bf92f3577b34da6a3ce929d0e0e4736"

            val res = infra.post(
                port, "/api/v1/admin/products/republish",
                ADMIN + ("traceparent" to "00-$traceId-00f067aa0ba902b7-01"),
            )

            Then("요청은 성공하고, 행의 헤더에 같은 traceId 가 남는다") {
                res.statusCode() shouldBe 200
                productJdbc.queryForObject(
                    "SELECT headers FROM outbox_event WHERE event_type = 'product.item.updated' ORDER BY id DESC LIMIT 1", String::class.java,
                )!! shouldContain traceId
            }

            Then("리스너의 MDC traceId 가 요청의 traceId 와 같다") {
                val seen = requireNotNull(probe.seen.poll(60, TimeUnit.SECONDS)) { "탐침 리스너가 레코드를 받지 못했다" }
                seen.traceparent!! shouldContain traceId
                seen.mdcTraceId shouldBe traceId
            }
        }

        // 운영 샘플링은 0.1 이다 — 열 중 아홉은 sampled=00 으로 들어온다. 기록하지 않는 요청이어도
        // traceId 는 이어져야 로그를 한 줄로 꿸 수 있다.
        Given("샘플링되지 않은(flags 00) traceparent 를 단 요청") {
            val traceId = "0af7651916cd43dd8448eb211c80319c"

            val res = infra.post(
                port, "/api/v1/admin/products/republish",
                ADMIN + ("traceparent" to "00-$traceId-b7ad6b7169203331-00"),
            )

            Then("리스너의 MDC traceId 가 그 요청의 traceId 와 같다") {
                res.statusCode() shouldBe 200
                // 재발행은 상품마다 레코드를 낸다 — 이 요청의 레코드가 나올 때까지 앞선 것은 건너뛴다
                val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(60)
                var mine: Seen? = null
                while (mine == null && System.nanoTime() < deadline) {
                    val next = probe.seen.poll(1, TimeUnit.SECONDS) ?: continue
                    if (next.traceparent?.contains(traceId) == true) mine = next
                }
                requireNotNull(mine) { "이 요청의 traceId 를 단 레코드가 오지 않았다 — 비샘플 요청에서 전파가 끊겼다" }
                mine.mdcTraceId shouldBe traceId
            }
        }

        Given("운영 지표 — 실제 스키마에서 센 값") {
            Then("사가·결제·정산 게이지가 등록되고 SQL 이 실제 스키마에서 돈다") {
                ctx.getBean(OrderSagaMetrics::class.java).refresh().getOrThrow()
                ctx.getBean(PaymentOpsMetrics::class.java).refresh().getOrThrow()
                ctx.getBean(SettlementOpsMetrics::class.java).refresh().getOrThrow()
                val registry = ctx.getBean(MeterRegistry::class.java)
                registry.get("commerce_saga_active").tag("status", "RUNNING").gauge().value() shouldBe 0.0
                registry.get("commerce_saga_step_dwell_max_seconds").gauge().value() shouldBe 0.0
                registry.get("commerce_saga_compensations").gauge().value() shouldBe 0.0
                registry.get("commerce_payment_unknown").gauge().value() shouldBe 0.0
                registry.get("commerce_reconciliation_mismatch").gauge().value() shouldBe 0.0
                registry.get("commerce_settlement_payout_won").tag("status", "PAID").gauge().value() shouldBe 0.0
            }
        }
    }

    companion object {
        private val infra = OpsIntegrationInfra()
        private val ADMIN = OpsIntegrationInfra.ADMIN

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) = infra.register(registry)
    }
}
