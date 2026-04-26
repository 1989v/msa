package com.kgd.quant.infrastructure.security

import com.kgd.quant.application.port.security.KeyManagementService
import com.kgd.quant.application.port.security.WrappedDek
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import com.kgd.quant.infrastructure.persistence.entity.ExchangeCredentialEntity
import com.kgd.quant.infrastructure.persistence.entity.NotificationTargetEntity
import com.kgd.quant.infrastructure.persistence.repository.ExchangeCredentialJpaRepository
import com.kgd.quant.infrastructure.persistence.repository.NotificationTargetJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * TG-P2-04.4 — KEK 회전 후 backlog 를 점진적으로 재암호화하는 백그라운드 잡.
 *
 * ## 흐름 (1분 polling)
 *  1. 현재 활성 KEK 버전 조회 → INT 변환 ([KekVersionLabel.toInt]).
 *  2. `WHERE kek_version < (current) LIMIT 100` 으로 stale row scan (인덱스: `idx_*_kek_version`).
 *  3. 각 row:
 *     - `dek_wrapped IS NULL` 이면 Phase 1 fallback row → **본 잡에서는 skip** (별도 마이그레이션 정책).
 *     - envelope decrypt (KMS unwrap, 트랜잭션 밖) → re-encrypt 모든 컬럼을 **단일 DEK** 로
 *       묶어 ([EnvelopeCryptoCodec.encryptGroup]) optimistic lock update.
 *     - update count = 0 (다른 잡 인스턴스가 먼저 처리) → silent skip.
 *  4. 메트릭 `quant.kek.rotation.lazy_reencrypt_total{from_version,to_version,table}` 증가.
 *
 * ## 단일 DEK 정책 (envelope group)
 *  - `dek_wrapped` 컬럼은 row 당 1개. apiKey / apiSecret / passphrase 셋을 모두 같은 DEK 로 wrap 해야
 *    저장 후 read 경로에서 단일 unwrap 으로 모든 컬럼이 복호 가능하다.
 *  - [EnvelopeCryptoCodec.encryptGroup] 가 이 invariant 를 보장한다.
 *
 * ## 트랜잭션
 *  - 본 잡 자체에는 `@Transactional` 미부여 (ADR-0020 — KMS 호출은 외부 IO).
 *  - 실 UPDATE 만 [EnvelopeUpdateExecutor] 의 별도 빈 메서드에서 `@Transactional` 짧게 적용.
 *  - decrypt → encrypt 연산은 트랜잭션 밖에서 실행 (KMS 호출이 DB 락을 잡지 않도록).
 *
 * ## 활성 조건
 *  - `quant.security.lazy-reencryption.enabled` (default true).
 *  - `@Profile("!test")` — 테스트는 `runOnce()` 직접 호출 (스케줄러 비활성).
 *
 * ## Idempotent
 *  - 동일 row 재실행 시 `kek_version = current` 이면 scan 결과에 포함되지 않으므로 자연 idempotent.
 *  - 다중 잡 인스턴스 동시 실행 시 optimistic lock 으로 1건만 성공 (TG-P2-04.5 OptimisticLockConcurrencySpec).
 */
@Component
@Profile("!test")
@ConditionalOnProperty(
    name = ["quant.security.lazy-reencryption.enabled"],
    havingValue = "true",
    matchIfMissing = true
)
class LazyReencryptionJob(
    private val codec: EnvelopeCryptoCodec,
    private val kms: KeyManagementService,
    private val credentialRepo: ExchangeCredentialJpaRepository,
    private val notificationRepo: NotificationTargetJpaRepository,
    private val updateExecutor: EnvelopeUpdateExecutor,
    private val metrics: QuantMetrics
) {

    /**
     * 1분 간격 polling. fixedDelay = 직전 실행 종료 후 60초 (잡이 길어져도 동시 실행 회피).
     */
    @Scheduled(fixedDelay = POLL_INTERVAL_MS)
    fun runScheduled() {
        runOnce()
    }

    /**
     * 1회 실행 entry point. 테스트에서 직접 호출 가능.
     *
     * @return 처리 결과 요약 (재암호화 성공 row 수 + skip 수).
     */
    fun runOnce(): RunSummary = runBlocking {
        val currentLabel = kms.currentKekVersion()
        val targetVersion = KekVersionLabel.toInt(currentLabel)

        val credentialResult = processCredentials(targetVersion)
        val notificationResult = processNotifications(targetVersion)

        RunSummary(
            credentialReencrypted = credentialResult.reencrypted,
            credentialSkipped = credentialResult.skipped,
            notificationReencrypted = notificationResult.reencrypted,
            notificationSkipped = notificationResult.skipped,
            targetVersion = targetVersion
        )
    }

    private suspend fun processCredentials(targetVersion: Int): TableResult {
        val stale = credentialRepo.findTop100ByKekVersionLessThanOrderByCreatedAtAsc(targetVersion)
        var reencrypted = 0
        var skipped = 0
        for (entity in stale) {
            when (reencryptCredential(entity, targetVersion)) {
                Outcome.REENCRYPTED -> {
                    reencrypted++
                    metrics.kekRotationReencrypted(entity.kekVersion, targetVersion, TABLE_EXCHANGE_CREDENTIAL)
                }
                Outcome.SKIPPED, Outcome.FAILED -> skipped++
            }
        }
        return TableResult(reencrypted, skipped)
    }

    private suspend fun processNotifications(targetVersion: Int): TableResult {
        val stale = notificationRepo.findTop100ByKekVersionLessThanOrderByCreatedAtAsc(targetVersion)
        var reencrypted = 0
        var skipped = 0
        for (entity in stale) {
            when (reencryptNotification(entity, targetVersion)) {
                Outcome.REENCRYPTED -> {
                    reencrypted++
                    metrics.kekRotationReencrypted(entity.kekVersion, targetVersion, TABLE_NOTIFICATION_TARGET)
                }
                Outcome.SKIPPED, Outcome.FAILED -> skipped++
            }
        }
        return TableResult(reencrypted, skipped)
    }

    private suspend fun reencryptCredential(
        entity: ExchangeCredentialEntity,
        targetVersion: Int
    ): Outcome {
        val dekWrapped = entity.dekWrapped
        if (dekWrapped == null) {
            // Phase 1 fallback row — 본 잡 범위 외 (SOP 문서 §"Phase 1 → Phase 2 marshal" 참조).
            log.debug { "skip Phase 1 fallback credential row id=${entity.credentialId} (dek_wrapped IS NULL)" }
            return Outcome.SKIPPED
        }
        return try {
            val oldVersionLabel = KekVersionLabel.toLocalLabel(entity.kekVersion)
            val oldWrapped = WrappedDek(dekWrapped, oldVersionLabel)
            val apiKeyPlain = codec.decrypt(entity.apiKeyCipher, oldWrapped)
            val apiSecretPlain = codec.decrypt(entity.apiSecretCipher, oldWrapped)
            val passphrasePlain = entity.passphraseCipher?.let { codec.decrypt(it, oldWrapped) }

            // 단일 DEK 로 묶어 wrap — read 경로에서 동일 wrappedDek 한 번만 unwrap 하면 모든 컬럼 복호 가능.
            val plaintexts = mutableListOf(apiKeyPlain, apiSecretPlain)
            passphrasePlain?.let { plaintexts.add(it) }
            val group = codec.encryptGroup(plaintexts)

            // best-effort wipe — JVM 보장 X 이지만 노출 표면 축소.
            apiKeyPlain.fill(0)
            apiSecretPlain.fill(0)
            passphrasePlain?.fill(0)

            val newApiKeyCt = group.ciphertexts[0]
            val newApiSecretCt = group.ciphertexts[1]
            val newPassphraseCt = if (passphrasePlain != null) group.ciphertexts[2] else null
            val newDekVersion = KekVersionLabel.toInt(group.wrappedDek.kekVersion)

            val updated = updateExecutor.updateCredential(
                credentialId = entity.credentialId,
                expectedOldVersion = entity.kekVersion,
                apiKeyCt = newApiKeyCt,
                apiSecretCt = newApiSecretCt,
                passphraseCt = newPassphraseCt,
                dekWrapped = group.wrappedDek.ciphertext,
                newVersion = newDekVersion
            )
            if (updated == 0) {
                log.debug {
                    "lazy re-encrypt skip (optimistic lock) credentialId=${entity.credentialId} " +
                        "expectedOldVersion=${entity.kekVersion}"
                }
                Outcome.SKIPPED
            } else {
                Outcome.REENCRYPTED
            }
        } catch (e: Exception) {
            log.warn(e) { "lazy re-encrypt failed credentialId=${entity.credentialId}" }
            Outcome.FAILED
        }
    }

    private suspend fun reencryptNotification(
        entity: NotificationTargetEntity,
        targetVersion: Int
    ): Outcome {
        val dekWrapped = entity.dekWrapped
        if (dekWrapped == null) {
            log.debug { "skip Phase 1 fallback notification row id=${entity.targetId} (dek_wrapped IS NULL)" }
            return Outcome.SKIPPED
        }
        return try {
            val oldVersionLabel = KekVersionLabel.toLocalLabel(entity.kekVersion)
            val oldWrapped = WrappedDek(dekWrapped, oldVersionLabel)
            val plain = codec.decrypt(entity.botTokenCipher, oldWrapped)

            val newEnvelope = codec.encrypt(plain)
            plain.fill(0)
            val newDekVersion = KekVersionLabel.toInt(newEnvelope.wrappedDek.kekVersion)
            val updated = updateExecutor.updateNotification(
                targetId = entity.targetId,
                expectedOldVersion = entity.kekVersion,
                botTokenCt = newEnvelope.ciphertext,
                dekWrapped = newEnvelope.wrappedDek.ciphertext,
                newVersion = newDekVersion
            )
            if (updated == 0) {
                log.debug {
                    "lazy re-encrypt skip (optimistic lock) targetId=${entity.targetId} " +
                        "expectedOldVersion=${entity.kekVersion}"
                }
                Outcome.SKIPPED
            } else {
                Outcome.REENCRYPTED
            }
        } catch (e: Exception) {
            log.warn(e) { "lazy re-encrypt failed notification targetId=${entity.targetId}" }
            Outcome.FAILED
        }
    }

    enum class Outcome { REENCRYPTED, SKIPPED, FAILED }

    data class TableResult(val reencrypted: Int, val skipped: Int)

    /** 1회 실행 결과 (테스트 검증용). */
    data class RunSummary(
        val credentialReencrypted: Int,
        val credentialSkipped: Int,
        val notificationReencrypted: Int,
        val notificationSkipped: Int,
        val targetVersion: Int
    ) {
        val totalReencrypted: Int get() = credentialReencrypted + notificationReencrypted
    }

    companion object {
        private const val POLL_INTERVAL_MS = 60_000L
        private const val TABLE_EXCHANGE_CREDENTIAL = "exchange_credential"
        private const val TABLE_NOTIFICATION_TARGET = "notification_target"
    }
}
