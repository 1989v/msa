package com.kgd.quant.infrastructure.security

import com.kgd.quant.infrastructure.metrics.QuantMetrics
import com.kgd.quant.infrastructure.security.kms.FakeKmsAdapter
import com.kgd.quant.infrastructure.security.kms.KmsDekCache
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import kotlinx.coroutines.runBlocking

/**
 * TG-P2-04.5 — `EnvelopeCryptoCodec` round-trip 검증.
 *
 * - encrypt → decrypt 동등성 (단순 ASCII / random binary / empty / 1KB)
 * - 동일 plaintext 두 번 encrypt 시 ciphertext / wrapped DEK 가 다르다 (DEK 매번 새로 생성)
 * - kekVersion 라벨 유지
 * - 변조된 ciphertext 는 AEAD tag 검증 실패로 예외
 * - toString 마스킹 검증
 */
class EnvelopeEncryptionRoundTripSpec : BehaviorSpec({

    fun newCodec(): Pair<EnvelopeCryptoCodec, FakeKmsAdapter> {
        val kms = FakeKmsAdapter(seed = 1234L)
        val metrics = QuantMetrics(SimpleMeterRegistry())
        val cache = KmsDekCache(kms, metrics)
        return EnvelopeCryptoCodec(kms, cache) to kms
    }

    Given("EnvelopeCryptoCodec + FakeKmsAdapter") {

        When("ASCII plaintext 를 encrypt → decrypt") {
            val (codec, _) = newCodec()
            val plaintext = "bithumb-api-key-ABCDEFG".toByteArray(Charsets.UTF_8)
            val envelope = runBlocking { codec.encrypt(plaintext) }
            val recovered = runBlocking { codec.decrypt(envelope.ciphertext, envelope.wrappedDek) }

            Then("원본과 동일한 byte 배열을 복원한다") {
                recovered.toList() shouldBe plaintext.toList()
            }

            Then("kekVersion 라벨이 유지된다 (fake-v1)") {
                envelope.wrappedDek.kekVersion shouldBe "fake-v1"
            }
        }

        When("random binary 1KB plaintext round-trip") {
            val (codec, _) = newCodec()
            val plaintext = ByteArray(1024) { (it xor 0x5A).toByte() }
            val envelope = runBlocking { codec.encrypt(plaintext) }
            val recovered = runBlocking { codec.decrypt(envelope.ciphertext, envelope.wrappedDek) }

            Then("동일 byte 배열 복원") {
                recovered.toList() shouldBe plaintext.toList()
            }
        }

        When("empty plaintext round-trip") {
            val (codec, _) = newCodec()
            val plaintext = ByteArray(0)
            val envelope = runBlocking { codec.encrypt(plaintext) }
            val recovered = runBlocking { codec.decrypt(envelope.ciphertext, envelope.wrappedDek) }

            Then("empty byte 배열 복원, ciphertext 는 IV+tag 만 포함") {
                recovered.size shouldBe 0
                envelope.ciphertext.size shouldBe (12 + 16)  // IV + GCM tag
            }
        }

        When("동일 plaintext 를 두 번 encrypt") {
            val (codec, _) = newCodec()
            val plaintext = "duplicate-source".toByteArray()
            val first = runBlocking { codec.encrypt(plaintext) }
            val second = runBlocking { codec.encrypt(plaintext) }

            Then("ciphertext 가 다르다 (DEK 가 매번 새로 생성됨)") {
                first.ciphertext.toList() shouldNotBe second.ciphertext.toList()
            }
            Then("wrapped DEK 도 다르다") {
                first.wrappedDek.ciphertext.toList() shouldNotBe second.wrappedDek.ciphertext.toList()
            }
            Then("두 envelope 모두 정상 decrypt 가능") {
                runBlocking { codec.decrypt(first.ciphertext, first.wrappedDek) }.toList() shouldBe plaintext.toList()
                runBlocking { codec.decrypt(second.ciphertext, second.wrappedDek) }.toList() shouldBe plaintext.toList()
            }
        }

        When("ciphertext 마지막 byte 변조 시 decrypt") {
            val (codec, _) = newCodec()
            val plaintext = "tamper-test".toByteArray()
            val envelope = runBlocking { codec.encrypt(plaintext) }
            val tampered = envelope.ciphertext.copyOf()
            tampered[tampered.size - 1] = (tampered[tampered.size - 1].toInt() xor 0x01).toByte()

            Then("AEAD tag 검증 실패로 예외 throw") {
                shouldThrow<javax.crypto.AEADBadTagException> {
                    runBlocking { codec.decrypt(tampered, envelope.wrappedDek) }
                }
            }
        }

        When("ciphertext 가 IV 길이보다 짧을 때") {
            val (codec, _) = newCodec()
            val tinyCt = ByteArray(5)
            val fakeWrapped = runBlocking { newCodec().second.wrap(ByteArray(32) { it.toByte() }) }

            Then("require 위반으로 IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> {
                    runBlocking { codec.decrypt(tinyCt, fakeWrapped) }
                }
            }
        }
    }

    Given("EnvelopeCiphertext.toString 마스킹") {
        val (codec, _) = newCodec()
        val envelope = runBlocking { codec.encrypt("secret-token".toByteArray()) }
        val str = envelope.toString()

        Then("ciphertext / wrapped DEK 모두 평문/원시 hex 가 노출되지 않는다") {
            str.contains("REDACTED") shouldBe true
            str.contains("kekVersion=fake-v1") shouldBe true
        }
    }
})
