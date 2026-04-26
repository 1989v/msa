package com.kgd.sevensplit.domain.tenant

import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.credential.Exchange
import com.kgd.sevensplit.domain.credential.ExchangeCredential
import com.kgd.sevensplit.domain.fixtures.SplitFixtures
import com.kgd.sevensplit.domain.notification.NotificationChannel
import com.kgd.sevensplit.domain.notification.NotificationTarget
import com.kgd.sevensplit.domain.strategy.SplitStrategy
import com.kgd.sevensplit.domain.strategy.StrategyRun
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import java.util.UUID
import kotlin.reflect.full.memberProperties

/**
 * INV-05 tenantId 강제:
 *   모든 주요 Aggregate / Entity 는 tenantId 프로퍼티를 갖는다.
 *   - SplitStrategy / StrategyRun / ExchangeCredential / NotificationTarget 은 tenantId 직접 보유
 *   - RoundSlot / Order 는 각각 RunId / SlotId 로 간접 보유 (문서화 주석 참고)
 *
 *   TenantId 자체는 blank 문자열을 허용하지 않아 생성 시점에 가드된다.
 */
class TenantIsolationSpec : BehaviorSpec({

    Given("tenantId 직접 보유 Aggregate 목록") {
        Then("SplitStrategy / StrategyRun / ExchangeCredential / NotificationTarget 모두 tenantId 를 갖는다") {
            // INV-05
            val classes = listOf(
                SplitStrategy::class,
                StrategyRun::class,
                ExchangeCredential::class,
                NotificationTarget::class
            )
            classes.forEach { klass ->
                val hasTenant = klass.memberProperties.any { it.name == "tenantId" }
                withClue(klass.simpleName + " 은 tenantId 를 보유해야 한다") {
                    hasTenant shouldBe true
                }
            }
        }
    }

    Given("실제 Aggregate 인스턴스") {
        When("tenantId 를 읽으면") {
            Then("전달한 값과 동일하다") {
                // INV-05
                val tenant = TenantId("tenant-A")
                val strategy = SplitFixtures.newStrategy(tenantId = "tenant-A")
                strategy.tenantId shouldBe tenant

                val run = SplitFixtures.newRun(tenantId = "tenant-A")
                run.tenantId shouldBe tenant

                val credential = ExchangeCredential(
                    credentialId = UUID.randomUUID(),
                    tenantId = tenant,
                    exchange = Exchange.BITHUMB,
                    apiKeyCipher = "k".toByteArray(),
                    apiSecretCipher = "s".toByteArray(),
                    passphraseCipher = null,
                    ipWhitelist = emptyList()
                )
                credential.tenantId shouldBe tenant

                val target = NotificationTarget(
                    tenantId = tenant,
                    channel = NotificationChannel.TELEGRAM,
                    botTokenCipher = "t".toByteArray(),
                    chatId = "123"
                )
                target.tenantId shouldBe tenant
            }
        }
    }

    Given("공백 tenantId 로 TenantId 생성 시도") {
        Then("IllegalArgumentException 이 발생한다") {
            // INV-05 — tenant 식별자 강제
            shouldThrow<IllegalArgumentException> { TenantId("") }
            shouldThrow<IllegalArgumentException> { TenantId("   ") }
        }
    }

    Given("ExchangeCredential 과 NotificationTarget") {
        Then("toString 에서 민감 필드는 마스킹되지만 tenantId 는 노출된다") {
            // INV-05 + 보안 마스킹
            val tenant = TenantId("tenant-B")
            val credential = ExchangeCredential(
                credentialId = UUID.randomUUID(),
                tenantId = tenant,
                exchange = Exchange.UPBIT,
                apiKeyCipher = "apikey".toByteArray(),
                apiSecretCipher = "secret".toByteArray(),
                passphraseCipher = "phrase".toByteArray(),
                ipWhitelist = listOf("1.2.3.4")
            )
            val rendered = credential.toString()
            rendered shouldContain "tenant-B"
            rendered shouldContain "[REDACTED]"
            rendered shouldNotBe "apikey"
            rendered shouldNotBe "secret"
        }
    }
})

private fun <T> withClue(message: String, block: () -> T): T =
    io.kotest.assertions.withClue(message, block)
