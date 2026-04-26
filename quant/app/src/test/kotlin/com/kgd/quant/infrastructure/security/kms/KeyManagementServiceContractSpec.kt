package com.kgd.quant.infrastructure.security.kms

import com.kgd.quant.application.port.security.KeyManagementService
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.coroutines.runBlocking
import java.security.SecureRandom

/**
 * TG-P2-03.6 — Adapter 3종 (LocalFile / Fake / OciVault skip) 모두가 동일 Port
 * 시그니처로 round-trip(wrap → unwrap → 원본 일치) 을 만족함을 검증한다.
 *
 * OciVaultKmsAdapter 는 실 OCI 자격증명 필요 → `OciVaultKmsAdapterIntegrationSpec` 으로 분리
 * (`-Pinclude-oci-integration=true` 시 실행).
 */
class KeyManagementServiceContractSpec : BehaviorSpec({

    val adapters: Map<String, () -> KeyManagementService> = mapOf(
        "LocalFileKmsAdapter" to { newLocalFileAdapter() },
        "FakeKmsAdapter" to { FakeKmsAdapter(seed = 1L) }
    )

    adapters.forEach { (name, factory) ->
        Given("$name 가 활성 KEK 1개 보유") {
            val adapter = factory()
            val plaintextDek = ByteArray(32).also { SecureRandom().nextBytes(it) }

            When("wrap 후 unwrap 하면") {
                val wrapped = runBlocking { adapter.wrap(plaintextDek) }
                val recovered = runBlocking { adapter.unwrap(wrapped) }

                Then("원본 DEK 가 그대로 복원된다") {
                    recovered.toList() shouldBe plaintextDek.toList()
                }

                Then("WrappedDek.kekVersion 은 currentKekVersion 과 일치한다") {
                    val current = runBlocking { adapter.currentKekVersion() }
                    wrapped.kekVersion shouldBe current
                }

                Then("ciphertext 는 평문과 다르다") {
                    wrapped.ciphertext.toList() shouldNotBe plaintextDek.toList()
                }
            }

            When("동일 평문을 두 번 wrap 하면") {
                val w1 = runBlocking { adapter.wrap(plaintextDek) }
                val w2 = runBlocking { adapter.wrap(plaintextDek) }

                Then("AES-GCM IV 가 매번 달라 ciphertext 가 달라진다") {
                    w1.ciphertext.toList() shouldNotBe w2.ciphertext.toList()
                }

                Then("두 ciphertext 모두 unwrap 시 동일 평문 반환") {
                    runBlocking { adapter.unwrap(w1) }.toList() shouldBe plaintextDek.toList()
                    runBlocking { adapter.unwrap(w2) }.toList() shouldBe plaintextDek.toList()
                }
            }
        }
    }
}) {
    companion object {
        fun newLocalFileAdapter(
            current: String = "v1",
            versions: Map<String, String> = mapOf(
                "v1" to "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
            )
        ): LocalFileKmsAdapter = LocalFileKmsAdapter(
            LocalKmsProperties(currentVersion = current, kekVersions = versions)
        )
    }
}
