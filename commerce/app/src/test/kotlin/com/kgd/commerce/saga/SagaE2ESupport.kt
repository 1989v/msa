package com.kgd.commerce.saga

import com.kgd.payment.infrastructure.pg.mock.MockPgScenario
import com.kgd.payment.infrastructure.pg.mock.MockPgScenario.Outcome
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * 사가 E2E 의 모의 PG 시나리오. 시나리오는 **결제액**으로 고른다 — 주문 id 는 접수 뒤에야 알고 그 전에 사가가
 * 승인 단계에 닿을 수 있어서, 테스트마다 결제액을 다르게 잡고 그 값에 대본을 건다. 대본이 없으면 운영과 같이 승인.
 */
class ScriptedMockPgScenario : MockPgScenario {

    class Script(
        val authorize: Outcome = Outcome.APPROVE,
        /** 결과 미상 거래를 n 번째 조회할 때의 답 */
        val inquire: (Int) -> Outcome = { Outcome.APPROVE },
        /** 앞에서부터 이 횟수만큼 매입 호출이 응답 없음(재시도 가능 실패)으로 끝난다 */
        val captureFailures: Int = 0,
        /** 승인 답을 정하기 직전에 부른다(인자: orderNo) — 승인과 매입 사이에 보류를 만료시키는 데 쓴다 */
        val beforeAuthorize: (String) -> Unit = {},
    ) {
        val captureCalls = AtomicInteger()
    }

    private val scripts = ConcurrentHashMap<Long, Script>()

    /** 조회는 결제액을 받지 않는다 — 승인 때 본 (orderNo → 결제액) 을 기억해 둔다 */
    private val amountOf = ConcurrentHashMap<String, Long>()

    fun script(amount: Long, script: Script) {
        check(scripts.putIfAbsent(amount, script) == null) { "결제액 $amount 에 이미 대본이 있다 — 테스트마다 결제액을 다르게" }
    }

    override fun onAuthorize(orderNo: String, amount: Long): Outcome {
        amountOf[orderNo] = amount
        val s = scripts[amount] ?: return Outcome.APPROVE
        s.beforeAuthorize(orderNo)
        return s.authorize
    }

    override fun onInquire(orderNo: String, inquiryCount: Int): Outcome =
        amountOf[orderNo]?.let { scripts[it] }?.inquire?.invoke(inquiryCount) ?: Outcome.APPROVE

    override fun onCapture(orderNo: String, amount: Long): Outcome {
        val s = scripts[amount] ?: return Outcome.APPROVE
        return if (s.captureCalls.incrementAndGet() <= s.captureFailures) Outcome.TIMEOUT else Outcome.APPROVE
    }
}

/** 결제 도메인 시계 — 재조회 백오프(30초·1분·…)를 기다리지 않고 앞으로 돌린다 */
class AdvancingClock(private val base: Clock = Clock.systemUTC()) : Clock() {
    @Volatile
    private var offset: Duration = Duration.ZERO

    fun advance(by: Duration) {
        offset = offset.plus(by)
    }

    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId): Clock = this
    override fun instant(): Instant = base.instant().plus(offset)
}

@TestConfiguration(proxyBeanMethods = false)
class SagaE2EConfig {
    @Bean
    fun scriptedMockPgScenario(): ScriptedMockPgScenario = ScriptedMockPgScenario()

    /** 운영 빈 `paymentClock`(Clock.systemUTC)을 같은 이름으로 덮는다 — `spring.main.allow-bean-definition-overriding=true` */
    @Bean
    fun paymentClock(): Clock = AdvancingClock()
}
