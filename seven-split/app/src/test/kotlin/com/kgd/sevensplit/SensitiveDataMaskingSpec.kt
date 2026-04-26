package com.kgd.sevensplit

import com.kgd.sevensplit.application.port.credential.DecryptedCredential
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.domain.credential.Exchange
import com.kgd.sevensplit.domain.credential.ExchangeCredential
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import java.util.UUID

/**
 * TG-14.7 Acceptance: API key / Bot token 관련 로그 캡처 시 평문 미노출을 검증.
 *
 * ExchangeCredential, DecryptedCredential 두 타입 모두 `toString()` 이 평문을 노출하지 않음을 보장한다.
 * 로거는 대부분 문자열 변환에 `toString()` 을 사용하므로, 이 경로만 마스킹되어도 일반적인 로그 유출은 차단된다.
 */
class SensitiveDataMaskingSpec : BehaviorSpec({

    Given("ExchangeCredential (암호화된 ByteArray 보관)") {
        val credential = ExchangeCredential(
            credentialId = UUID.randomUUID(),
            tenantId = TenantId("t1"),
            exchange = Exchange.BITHUMB,
            apiKeyCipher = "SECRET_API_KEY_BYTES".toByteArray(),
            apiSecretCipher = "SECRET_API_SECRET_BYTES".toByteArray(),
            passphraseCipher = null,
            ipWhitelist = listOf("127.0.0.1"),
        )

        When("toString() 출력을 기록할 때") {
            val str = credential.toString()

            Then("apiKeyCipher / apiSecretCipher 내용이 평문으로 노출되지 않는다") {
                str shouldNotContain "SECRET_API_KEY_BYTES"
                str shouldNotContain "SECRET_API_SECRET_BYTES"
            }

            Then("REDACTED 마스킹 문자열이 포함된다") {
                str.contains("REDACTED") shouldBe true
                str shouldContain "[REDACTED]"
            }
        }
    }

    Given("DecryptedCredential (단명 wrapper, 평문 보유)") {
        val decrypted = DecryptedCredential(
            credentialId = UUID.randomUUID(),
            apiKey = "PLAINTEXT_KEY",
            apiSecret = "PLAINTEXT_SECRET",
            passphrase = null,
            ipWhitelist = emptyList(),
        )

        When("toString() 출력을 기록할 때") {
            val str = decrypted.toString()

            Then("평문 credential 이 문자열에 나타나지 않는다") {
                str shouldNotContain "PLAINTEXT_KEY"
                str shouldNotContain "PLAINTEXT_SECRET"
            }

            Then("REDACTED 마스킹 문자열이 포함된다") {
                str.contains("REDACTED") shouldBe true
                str shouldContain "[REDACTED]"
            }
        }
    }

    Given("DecryptedCredential with passphrase") {
        val decrypted = DecryptedCredential(
            credentialId = UUID.randomUUID(),
            apiKey = "KEY",
            apiSecret = "SEC",
            passphrase = "SECRET_PASSPHRASE_PLAIN",
            ipWhitelist = emptyList(),
        )

        When("toString() 출력") {
            val str = decrypted.toString()

            Then("passphrase 평문도 노출되지 않는다") {
                str shouldNotContain "SECRET_PASSPHRASE_PLAIN"
                str.contains("REDACTED") shouldBe true
            }
        }
    }
})
