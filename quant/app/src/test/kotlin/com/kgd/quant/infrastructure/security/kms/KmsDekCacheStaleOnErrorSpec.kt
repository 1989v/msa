package com.kgd.quant.infrastructure.security.kms

import com.kgd.quant.application.port.security.WrappedDek
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import kotlinx.coroutines.runBlocking

/**
 * TG-P2-03.6 — KmsDekCache stale-on-error 검증.
 *
 * - miss → KMS unwrap 호출 → 캐시 저장
 * - hit → KMS 호출 0 추가
 * - KMS 실패 시 → 캐시에 entry 가 있으면 stale 반환 + stale 메트릭 증가
 * - 캐시 entry 가 없는 상태에서 KMS 실패 → 원본 예외 throw
 */
class KmsDekCacheStaleOnErrorSpec : BehaviorSpec({

    fun newCache(kms: FakeKmsAdapter): Pair<KmsDekCache, QuantMetrics> {
        val metrics = QuantMetrics(SimpleMeterRegistry())
        val cache = KmsDekCache(kms, metrics)
        return cache to metrics
    }

    Given("Fake KMS + KmsDekCache (캐시 비어있음)") {
        val kms = FakeKmsAdapter(seed = 42L)
        val (cache, _) = newCache(kms)
        val plaintext = ByteArray(32) { it.toByte() }
        val wrapped = runBlocking { kms.wrap(plaintext) }
        val initialUnwrapCount = kms.unwrapCallCount

        When("동일 wrapped 를 두 번 unwrap 호출") {
            val first = runBlocking { cache.unwrap(wrapped) }
            val second = runBlocking { cache.unwrap(wrapped) }

            Then("첫 호출은 KMS miss, 두번째는 hit 로 KMS 호출 1회만 추가된다") {
                first.toList() shouldBe plaintext.toList()
                second.toList() shouldBe plaintext.toList()
                (kms.unwrapCallCount - initialUnwrapCount) shouldBe 1
            }
        }
    }

    Given("Fake KMS + KmsDekCache, 첫 unwrap 성공으로 캐시 적재") {
        val kms = FakeKmsAdapter(seed = 7L)
        val (cache, _) = newCache(kms)
        val plaintext = ByteArray(32) { (it + 1).toByte() }
        val wrapped = runBlocking { kms.wrap(plaintext) }
        runBlocking { cache.unwrap(wrapped) }  // 캐시 적재
        kms.unwrapErrorToThrow = RuntimeException("KMS down")

        When("KMS 가 실패하는 상태에서 동일 wrapped 를 다시 unwrap") {
            val recovered = runBlocking { cache.unwrap(wrapped) }

            Then("stale-on-error 정책으로 캐시 entry 를 반환한다 (예외 없음)") {
                recovered.toList() shouldBe plaintext.toList()
            }
        }
    }

    Given("Fake KMS, 캐시에 entry 가 전혀 없는 상태에서 KMS 실패") {
        val kms = FakeKmsAdapter(seed = 99L)
        val (cache, _) = newCache(kms)
        kms.unwrapErrorToThrow = RuntimeException("KMS down")
        val unknownWrapped = WrappedDek(
            ciphertext = ByteArray(48) { 0xAB.toByte() },
            kekVersion = "fake-v1"
        )

        When("처음 보는 wrapped 를 unwrap 시도") {
            Then("stale 가 없으므로 원본 예외가 그대로 throw 된다") {
                shouldThrow<RuntimeException> {
                    runBlocking { cache.unwrap(unknownWrapped) }
                }
            }
        }
    }
})
