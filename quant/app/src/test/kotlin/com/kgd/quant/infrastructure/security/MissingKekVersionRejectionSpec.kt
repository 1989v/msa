package com.kgd.quant.infrastructure.security

import com.kgd.quant.application.port.security.WrappedDek
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import com.kgd.quant.infrastructure.persistence.entity.ExchangeCredentialEntity
import com.kgd.quant.infrastructure.security.kms.FakeKmsAdapter
import com.kgd.quant.infrastructure.security.kms.KmsDekCache
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import jakarta.persistence.Column
import kotlinx.coroutines.runBlocking
import java.time.Instant
import java.util.UUID

/**
 * TG-P2-04.5 — INV-P2-11: `kek_version` NOT NULL 강제 검증.
 *
 * 1. Entity 컬럼 정의 자체가 `nullable=false` (스키마 자체 INV).
 * 2. Adapter read 경로에서 알 수 없는 KEK 버전 라벨로 unwrap 시 `IllegalStateException`.
 * 3. `dek_wrapped IS NULL` (Phase 1 fallback) row 는 envelope decrypt 호출 시 의도적 분기 필요 —
 *    잘못 envelope 경로로 unwrap 시 `WrappedDek` 생성 자체가 막히지는 않지만 `IllegalArgumentException`.
 */
class MissingKekVersionRejectionSpec : BehaviorSpec({

    Given("ExchangeCredentialEntity 의 kek_version 컬럼") {
        val field = ExchangeCredentialEntity::class.java.getDeclaredField("kekVersion")
        val column = field.getAnnotation(Column::class.java)

        Then("nullable = false 가 컴파일타임 보장") {
            column shouldNotBe null
            column.nullable shouldBe false
        }
    }

    Given("ExchangeCredentialEntity 의 dek_wrapped 컬럼") {
        val field = ExchangeCredentialEntity::class.java.getDeclaredField("dekWrapped")
        val column = field.getAnnotation(Column::class.java)

        Then("nullable = true (Phase 1 fallback row 호환)") {
            column shouldNotBe null
            column.nullable shouldBe true
        }
    }

    Given("Codec + 알 수 없는 KEK 버전 라벨") {
        val kms = FakeKmsAdapter(seed = 0L)
        val cache = KmsDekCache(kms, QuantMetrics(SimpleMeterRegistry()))
        val codec = EnvelopeCryptoCodec(kms, cache)
        // 정상 envelope 생성 후 라벨만 변조
        val plain = "x".toByteArray()
        val good = runBlocking { codec.encrypt(plain) }
        val tamperedWrapped = WrappedDek(good.wrappedDek.ciphertext, "fake-v999")

        When("decrypt 시도") {
            Then("FakeKmsAdapter 가 unknown 버전으로 IllegalStateException throw") {
                shouldThrow<IllegalStateException> {
                    runBlocking { codec.decrypt(good.ciphertext, tamperedWrapped) }
                }
            }
        }
    }

    Given("Codec + 잘못된 짧은 ciphertext (Phase 1 row 를 envelope 경로로 잘못 호출한 시나리오)") {
        val kms = FakeKmsAdapter(seed = 0L)
        val cache = KmsDekCache(kms, QuantMetrics(SimpleMeterRegistry()))
        val codec = EnvelopeCryptoCodec(kms, cache)
        val tinyCt = ByteArray(8)  // < IV_LENGTH (12)
        val anyWrapped = runBlocking { kms.wrap(ByteArray(32) { it.toByte() }) }

        When("decrypt 호출") {
            Then("require 위반으로 IllegalArgumentException") {
                shouldThrow<IllegalArgumentException> {
                    runBlocking { codec.decrypt(tinyCt, anyWrapped) }
                }
            }
        }
    }

    Given("KekVersionLabel.toInt 입력 검증") {
        Then("local-vN / fake-vN 정상 매핑") {
            KekVersionLabel.toInt("local-v1") shouldBe 1
            KekVersionLabel.toInt("local-v42") shouldBe 42
            KekVersionLabel.toInt("fake-v7") shouldBe 7
        }
        Then("blank 라벨은 default = 1") {
            KekVersionLabel.toInt("") shouldBe 1
            KekVersionLabel.toInt("   ") shouldBe 1
        }
        Then("OCID 같은 임의 라벨은 hashCode 절댓값 ≥ 1") {
            val v = KekVersionLabel.toInt("ocid1.keyversion.oc1.iad.abcdef")
            (v >= 1) shouldBe true
        }
    }

    Given("Entity default 생성자 동작") {
        val e = ExchangeCredentialEntity(
            credentialId = UUID.randomUUID(),
            tenantId = "t",
            exchange = "BITHUMB",
            apiKeyCipher = ByteArray(0),
            apiSecretCipher = ByteArray(0),
            passphraseCipher = null,
            ipWhitelist = "[]",
            createdAt = Instant.now()
        )

        Then("kekVersion default = 1 (V002 default)") {
            e.kekVersion shouldBe 1
        }
        Then("dekWrapped default = null (Phase 1 fallback)") {
            (e.dekWrapped == null) shouldBe true
        }
    }
})
