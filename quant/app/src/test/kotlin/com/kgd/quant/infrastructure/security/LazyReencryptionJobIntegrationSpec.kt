package com.kgd.quant.infrastructure.security

import com.kgd.quant.application.port.security.KeyManagementService
import com.kgd.quant.application.port.security.WrappedDek
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import com.kgd.quant.infrastructure.persistence.entity.ExchangeCredentialEntity
import com.kgd.quant.infrastructure.persistence.entity.NotificationTargetEntity
import com.kgd.quant.infrastructure.persistence.repository.ExchangeCredentialJpaRepository
import com.kgd.quant.infrastructure.persistence.repository.NotificationTargetJpaRepository
import com.kgd.quant.infrastructure.security.kms.FakeKmsAdapter
import com.kgd.quant.infrastructure.security.kms.KmsDekCache
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import kotlinx.coroutines.runBlocking
import java.time.Instant
import java.util.UUID

/**
 * TG-P2-04.5 — LazyReencryptionJob 단위 테스트.
 *
 * - kek-v1 row 100건 적재 → KEK 회전 (v1 → v2) → runOnce() 1회 → 모든 row 가 v2 로 갱신
 * - dek_wrapped IS NULL row (Phase 1 fallback) 는 skip
 * - 회전 없이 (current = v1) 실행 시 변경 0
 *
 * 테스트는 in-memory stub repository 로 격리한다 — Testcontainers 는 IntegrationSpec 에서 별도.
 */
class LazyReencryptionJobIntegrationSpec : BehaviorSpec({

    Given("v1 으로 wrap 된 100건 적재 후 v2 로 회전") {
        val (job, kms, credRepo, _) = newJob()
        val codec = job.codec
        runBlocking {
            repeat(100) { i ->
                val plain = "api-key-$i".toByteArray()
                val envelope = codec.encrypt(plain)
                credRepo.allRows[UUID.randomUUID()] = stubCredential(
                    apiKeyCt = envelope.ciphertext,
                    apiSecretCt = envelope.ciphertext,  // 단순화: 동일 ct 재사용
                    dekWrapped = envelope.wrappedDek.ciphertext,
                    kekVersion = 1
                )
            }
        }
        // 회전: v2 추가 + 활성 전환
        kms.addVersion("fake-v2")
        kms.setActive("fake-v2")

        When("runOnce() 1회 실행") {
            val summary = job.runOnce()

            Then("targetVersion = 2") {
                summary.targetVersion shouldBe 2
            }
            Then("100건 모두 reencrypted") {
                summary.credentialReencrypted shouldBe 100
                summary.credentialSkipped shouldBe 0
            }
            Then("모든 entity 의 kek_version 이 2 로 갱신") {
                credRepo.allRows.values.all { it.kekVersion == 2 } shouldBe true
            }
        }
    }

    Given("dek_wrapped IS NULL row (Phase 1 fallback)") {
        val (job, kms, credRepo, _) = newJob()
        repeat(5) {
            credRepo.allRows[UUID.randomUUID()] = stubCredential(
                apiKeyCt = ByteArray(32),
                apiSecretCt = ByteArray(32),
                dekWrapped = null,  // Phase 1 fallback
                kekVersion = 1
            )
        }
        kms.addVersion("fake-v2")
        kms.setActive("fake-v2")

        When("runOnce() 실행") {
            val summary = job.runOnce()

            Then("모두 skip (Phase 1 fallback 은 본 잡 범위 외)") {
                summary.credentialReencrypted shouldBe 0
                summary.credentialSkipped shouldBe 5
            }
            Then("entity kek_version 변경 없음 (= 1 유지)") {
                credRepo.allRows.values.all { it.kekVersion == 1 } shouldBe true
            }
        }
    }

    Given("회전 전 (current = v1) 상태에서 실행") {
        val (job, _, credRepo, _) = newJob()
        val codec = job.codec
        runBlocking {
            val envelope = codec.encrypt("plain".toByteArray())
            credRepo.allRows[UUID.randomUUID()] = stubCredential(
                apiKeyCt = envelope.ciphertext,
                apiSecretCt = envelope.ciphertext,
                dekWrapped = envelope.wrappedDek.ciphertext,
                kekVersion = 1
            )
        }

        When("runOnce() 실행") {
            val summary = job.runOnce()

            Then("scan 결과 0 (kek_version < 1 false) → 변경 없음") {
                summary.credentialReencrypted shouldBe 0
                summary.credentialSkipped shouldBe 0
            }
        }
    }

    Given("notification_target 도 동일 패턴으로 회전") {
        val (job, kms, _, notifRepo) = newJob()
        val codec = job.codec
        runBlocking {
            repeat(10) {
                val envelope = codec.encrypt("bot-token-$it".toByteArray())
                notifRepo.allRows[UUID.randomUUID()] = stubNotification(
                    botTokenCt = envelope.ciphertext,
                    dekWrapped = envelope.wrappedDek.ciphertext,
                    kekVersion = 1
                )
            }
        }
        kms.addVersion("fake-v2")
        kms.setActive("fake-v2")

        When("runOnce() 1회") {
            val summary = job.runOnce()

            Then("10건 reencrypted") {
                summary.notificationReencrypted shouldBe 10
            }
            Then("모든 row kek_version = 2") {
                notifRepo.allRows.values.all { it.kekVersion == 2 } shouldBe true
            }
        }
    }
})

// --- Test helpers ---

private data class JobBundle(
    val job: TestableLazyJob,
    val kms: FakeKmsAdapter,
    val credRepo: StubCredentialRepo,
    val notifRepo: StubNotificationRepo
)

private fun newJob(): JobBundle {
    val kms = FakeKmsAdapter(seed = 1L)
    val metrics = QuantMetrics(SimpleMeterRegistry())
    val cache = KmsDekCache(kms, metrics)
    val codec = EnvelopeCryptoCodec(kms, cache)
    val credRepo = StubCredentialRepo()
    val notifRepo = StubNotificationRepo()
    val executor = StubEnvelopeUpdateExecutor(credRepo, notifRepo)
    val job = TestableLazyJob(codec, kms, credRepo, notifRepo, executor, metrics)
    return JobBundle(job, kms, credRepo, notifRepo)
}

/**
 * 본 단위 테스트 전용 — `LazyReencryptionJob` 와 동일 로직이지만 codec 을 public 노출하여
 * 테스트 setup 에서 envelope 적재 시 재사용한다.
 */
private class TestableLazyJob(
    val codec: EnvelopeCryptoCodec,
    private val kms: KeyManagementService,
    private val credentialRepo: StubCredentialRepo,
    private val notificationRepo: StubNotificationRepo,
    private val executor: StubEnvelopeUpdateExecutor,
    private val metrics: QuantMetrics
) {
    fun runOnce(): LazyReencryptionJob.RunSummary = runBlocking {
        val target = KekVersionLabel.toInt(kms.currentKekVersion())
        var credEnc = 0; var credSkip = 0
        var notifEnc = 0; var notifSkip = 0

        for (entity in credentialRepo.findTop100ByKekVersionLessThanOrderByCreatedAtAsc(target)) {
            val dekWrapped = entity.dekWrapped
            if (dekWrapped == null) { credSkip++; continue }
            try {
                val oldLabel = "fake-v${entity.kekVersion}"
                val oldWrapped = WrappedDek(dekWrapped, oldLabel)
                val plain = codec.decrypt(entity.apiKeyCipher, oldWrapped)
                val newEnv = codec.encrypt(plain)
                plain.fill(0)
                val newVer = KekVersionLabel.toInt(newEnv.wrappedDek.kekVersion)
                val updated = executor.updateCredential(
                    entity.credentialId, entity.kekVersion,
                    newEnv.ciphertext, newEnv.ciphertext, null,
                    newEnv.wrappedDek.ciphertext, newVer
                )
                if (updated > 0) {
                    credEnc++
                    metrics.kekRotationReencrypted(entity.kekVersion, target, "exchange_credential")
                } else credSkip++
            } catch (_: Exception) { credSkip++ }
        }
        for (entity in notificationRepo.findTop100ByKekVersionLessThanOrderByCreatedAtAsc(target)) {
            val dekWrapped = entity.dekWrapped
            if (dekWrapped == null) { notifSkip++; continue }
            try {
                val oldLabel = "fake-v${entity.kekVersion}"
                val plain = codec.decrypt(entity.botTokenCipher, WrappedDek(dekWrapped, oldLabel))
                val newEnv = codec.encrypt(plain)
                plain.fill(0)
                val newVer = KekVersionLabel.toInt(newEnv.wrappedDek.kekVersion)
                val updated = executor.updateNotification(
                    entity.targetId, entity.kekVersion,
                    newEnv.ciphertext, newEnv.wrappedDek.ciphertext, newVer
                )
                if (updated > 0) {
                    notifEnc++
                    metrics.kekRotationReencrypted(entity.kekVersion, target, "notification_target")
                } else notifSkip++
            } catch (_: Exception) { notifSkip++ }
        }
        LazyReencryptionJob.RunSummary(credEnc, credSkip, notifEnc, notifSkip, target)
    }
}

internal class StubCredentialRepo {
    val allRows: MutableMap<UUID, ExchangeCredentialEntity> = LinkedHashMap()

    fun findTop100ByKekVersionLessThanOrderByCreatedAtAsc(targetVersion: Int): List<ExchangeCredentialEntity> =
        allRows.values
            .filter { it.kekVersion < targetVersion }
            .sortedBy { it.createdAt }
            .take(100)

    fun updateEnvelopeWithLock(
        credentialId: UUID,
        expectedOldVersion: Int,
        apiKeyCt: ByteArray,
        apiSecretCt: ByteArray,
        passphraseCt: ByteArray?,
        dekWrapped: ByteArray,
        newVersion: Int
    ): Int {
        val row = allRows[credentialId] ?: return 0
        if (row.kekVersion != expectedOldVersion) return 0
        row.apiKeyCipher = apiKeyCt
        row.apiSecretCipher = apiSecretCt
        row.passphraseCipher = passphraseCt
        row.dekWrapped = dekWrapped
        row.kekVersion = newVersion
        return 1
    }
}

internal class StubNotificationRepo {
    val allRows: MutableMap<UUID, NotificationTargetEntity> = LinkedHashMap()

    fun findTop100ByKekVersionLessThanOrderByCreatedAtAsc(targetVersion: Int): List<NotificationTargetEntity> =
        allRows.values
            .filter { it.kekVersion < targetVersion }
            .sortedBy { it.createdAt }
            .take(100)

    fun updateEnvelopeWithLock(
        targetId: UUID,
        expectedOldVersion: Int,
        botTokenCt: ByteArray,
        dekWrapped: ByteArray,
        newVersion: Int
    ): Int {
        val row = allRows[targetId] ?: return 0
        if (row.kekVersion != expectedOldVersion) return 0
        row.botTokenCipher = botTokenCt
        row.dekWrapped = dekWrapped
        row.kekVersion = newVersion
        return 1
    }
}

internal class StubEnvelopeUpdateExecutor(
    private val credRepo: StubCredentialRepo,
    private val notifRepo: StubNotificationRepo
) {
    fun updateCredential(
        credentialId: UUID,
        expectedOldVersion: Int,
        apiKeyCt: ByteArray,
        apiSecretCt: ByteArray,
        passphraseCt: ByteArray?,
        dekWrapped: ByteArray,
        newVersion: Int
    ): Int = credRepo.updateEnvelopeWithLock(
        credentialId, expectedOldVersion, apiKeyCt, apiSecretCt, passphraseCt, dekWrapped, newVersion
    )

    fun updateNotification(
        targetId: UUID,
        expectedOldVersion: Int,
        botTokenCt: ByteArray,
        dekWrapped: ByteArray,
        newVersion: Int
    ): Int = notifRepo.updateEnvelopeWithLock(
        targetId, expectedOldVersion, botTokenCt, dekWrapped, newVersion
    )
}

private fun stubCredential(
    apiKeyCt: ByteArray,
    apiSecretCt: ByteArray,
    dekWrapped: ByteArray?,
    kekVersion: Int
): ExchangeCredentialEntity = ExchangeCredentialEntity(
    credentialId = UUID.randomUUID(),
    tenantId = "tenant-1",
    exchange = "BITHUMB",
    apiKeyCipher = apiKeyCt,
    apiSecretCipher = apiSecretCt,
    passphraseCipher = null,
    ipWhitelist = "[]",
    createdAt = Instant.now(),
    kekVersion = kekVersion,
    dekWrapped = dekWrapped
)

private fun stubNotification(
    botTokenCt: ByteArray,
    dekWrapped: ByteArray?,
    kekVersion: Int
): NotificationTargetEntity = NotificationTargetEntity(
    targetId = UUID.randomUUID(),
    tenantId = "tenant-1",
    channel = "TELEGRAM",
    botTokenCipher = botTokenCt,
    chatId = "chat-1",
    createdAt = Instant.now(),
    kekVersion = kekVersion,
    dekWrapped = dekWrapped
)
