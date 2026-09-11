package com.kgd.quant.infrastructure.security.kms

import io.kotest.core.annotation.EnabledIf
import io.kotest.core.annotation.Tags
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.coroutines.runBlocking
import java.security.SecureRandom

/**
 * TG-P2-03.6 — OciVaultKmsAdapter 실 OCI Vault 통합 테스트.
 *
 * **기본 skip** — `-Pinclude-oci-integration=true` 또는 `OCI_INTEGRATION=true` 환경변수가 설정된
 * CI nightly 잡에서만 실행한다. 다음 환경변수가 모두 세팅되어 있어야 한다:
 *
 * - `OCI_TENANCY`, `OCI_USER`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY_PATH`
 * - `OCI_REGION`, `OCI_VAULT_KEY_OCID`, `OCI_VAULT_CRYPTO_ENDPOINT`
 *
 * 실행 명령 예시:
 * ```
 * OCI_INTEGRATION=true ./gradlew :quant:app:test \
 *   --tests '*OciVaultKmsAdapterIntegrationSpec'
 * ```
 */
@Tags("oci-integration")
@EnabledIf(OciIntegrationCondition::class)
class OciVaultKmsAdapterIntegrationSpec : BehaviorSpec({

    Given("실 OCI Vault 자격증명이 환경변수로 주입됨") {
        val properties = OciKmsProperties(
            tenancyOcid = System.getenv("OCI_TENANCY"),
            userOcid = System.getenv("OCI_USER"),
            fingerprint = System.getenv("OCI_FINGERPRINT"),
            privateKeyPath = System.getenv("OCI_PRIVATE_KEY_PATH"),
            region = System.getenv("OCI_REGION"),
            vaultKeyOcid = System.getenv("OCI_VAULT_KEY_OCID"),
            cryptoEndpoint = System.getenv("OCI_VAULT_CRYPTO_ENDPOINT")
        )
        val adapter = OciVaultKmsAdapter(properties).apply { init() }
        val plaintext = ByteArray(32).also { SecureRandom().nextBytes(it) }

        When("실 KMS 로 wrap 후 unwrap") {
            val wrapped = runBlocking { adapter.wrap(plaintext) }
            val recovered = runBlocking { adapter.unwrap(wrapped) }

            Then("원본 DEK 와 일치한다") {
                recovered.toList() shouldBe plaintext.toList()
            }

            Then("ciphertext 는 평문과 다르다") {
                wrapped.ciphertext.toList() shouldNotBe plaintext.toList()
            }

            Then("kekVersion 은 vault-key-ocid OCID 가 그대로 반환된다") {
                wrapped.kekVersion shouldBe properties.vaultKeyOcid
            }
        }

        adapter.shutdown()
    }
})
