package com.kgd.quant.infrastructure.security.kms

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.runBlocking
import java.security.SecureRandom

/**
 * TG-P2-03.6 — LocalFileKmsAdapter 회전 시나리오.
 *
 * - v1 활성 상태에서 wrap → ciphertext / kekVersion 검증
 * - v2 추가 + active 전환 → currentKekVersion = local-v2
 * - 새 wrap 은 v2 사용, 기존 v1 ciphertext 도 unwrap 가능 (lazy re-encryption window)
 * - 알 수 없는 version 으로 unwrap 시도 → 예외
 */
class LocalFileKmsAdapterRotationSpec : BehaviorSpec({

    val v1Hex = "1111111111111111111111111111111111111111111111111111111111111111"
    val v2Hex = "2222222222222222222222222222222222222222222222222222222222222222"

    Given("LocalFileKmsAdapter v1 활성 + 같은 어댑터에 v2 추가/활성 전환") {
        val adapterV1 = LocalFileKmsAdapter(
            LocalKmsProperties(
                currentVersion = "v1",
                kekVersions = mapOf("v1" to v1Hex)
            )
        )
        val plaintext = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val wrappedV1 = runBlocking { adapterV1.wrap(plaintext) }

        When("v1 으로 wrap 된 결과를 검증하면") {
            Then("kekVersion 은 local-v1 이다") {
                wrappedV1.kekVersion shouldBe "local-v1"
            }
        }

        // v2 가 추가된 새 어댑터 인스턴스 (운영에서는 K8s Secret 갱신 + 재기동에 해당)
        val adapterV2 = LocalFileKmsAdapter(
            LocalKmsProperties(
                currentVersion = "v2",
                kekVersions = mapOf("v1" to v1Hex, "v2" to v2Hex)
            )
        )

        When("회전 후 currentKekVersion 을 조회하면") {
            Then("local-v2 가 반환된다") {
                runBlocking { adapterV2.currentKekVersion() } shouldBe "local-v2"
            }
        }

        When("회전 후에도 v1 ciphertext 를 unwrap 시도하면") {
            Then("원본 평문이 복원된다 (lazy re-encryption window 지원)") {
                val recovered = runBlocking { adapterV2.unwrap(wrappedV1) }
                recovered.toList() shouldBe plaintext.toList()
            }
        }

        When("회전 후 새 wrap 을 수행하면") {
            val wrappedV2 = runBlocking { adapterV2.wrap(plaintext) }
            Then("kekVersion 은 local-v2 이며 unwrap 가능하다") {
                wrappedV2.kekVersion shouldBe "local-v2"
                runBlocking { adapterV2.unwrap(wrappedV2) }.toList() shouldBe plaintext.toList()
            }
        }
    }

    Given("LocalFileKmsAdapter v2 만 보유 (v1 누락)") {
        val adapterV2Only = LocalFileKmsAdapter(
            LocalKmsProperties(
                currentVersion = "v2",
                kekVersions = mapOf("v2" to v2Hex)
            )
        )
        val adapterV1Only = LocalFileKmsAdapter(
            LocalKmsProperties(
                currentVersion = "v1",
                kekVersions = mapOf("v1" to v1Hex)
            )
        )
        val plaintext = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val wrappedV1 = runBlocking { adapterV1Only.wrap(plaintext) }

        When("v1 ciphertext 를 v2-only 어댑터로 unwrap 시도") {
            Then("IllegalStateException 으로 거부된다") {
                shouldThrow<IllegalStateException> {
                    runBlocking { adapterV2Only.unwrap(wrappedV1) }
                }
            }
        }
    }

    Given("kek-versions 가 비어 있는 설정") {
        val adapter = LocalFileKmsAdapter(
            LocalKmsProperties(currentVersion = "v1", kekVersions = emptyMap())
        )
        When("wrap 호출") {
            Then("IllegalArgumentException 으로 fail-fast") {
                shouldThrow<IllegalArgumentException> {
                    runBlocking { adapter.wrap(ByteArray(32)) }
                }
            }
        }
    }
})
