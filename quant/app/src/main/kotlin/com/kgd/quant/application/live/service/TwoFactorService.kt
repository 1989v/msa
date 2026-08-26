package com.kgd.quant.application.live.service

import com.kgd.quant.application.live.port.TwoFactorSecretRepositoryPort
import com.kgd.quant.application.live.usecase.ManageTwoFactorUseCase
import com.kgd.quant.application.metrics.port.QuantPhase3MetricsPort
import com.kgd.quant.application.security.AesGcmCipher
import com.kgd.quant.application.security.Base32
import com.kgd.quant.application.security.port.KeyManagementService
import com.kgd.quant.application.security.port.TwoFactorRateLimiterPort
import com.kgd.quant.application.security.port.TwoFactorTokenStorePort
import com.kgd.quant.application.security.port.WrappedDek
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.live.AuditEventType
import com.kgd.quant.domain.twofa.TotpVerifier
import com.kgd.quant.domain.twofa.TwoFactorSecret
import io.github.oshai.kotlinlogging.KotlinLogging
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import org.springframework.stereotype.Service

private val log = KotlinLogging.logger {}

/**
 * TwoFactorService — 사용자 2FA 등록/검증/백업 코드 (ADR-0037 / TG-P3-09 ~ TG-P3-12).
 *
 * 등록 흐름:
 * 1. random TOTP secret 32 bytes 생성
 * 2. random DEK 32 bytes 생성 → KMS.wrap → encryptedDek
 * 3. AES-256-GCM(secret, DEK) → encryptedSecret
 * 4. 8 개 백업 코드 random 생성, SHA-256 hex hash 만 저장
 * 5. base32(secret) 으로 otpauth URI 구성하여 응답 (DB 에는 secret 평문 안 남김)
 *
 * 검증 흐름:
 * 1. RateLimiter 가드 (5/min)
 * 2. encryptedDek → KMS.unwrap → DEK
 * 3. AES-256-GCM(encryptedSecret, DEK) → secret
 * 4. TotpVerifier.verify (±1 step)
 * 5. 성공 → 1) `lastVerifiedAt` 갱신 2) 5분 one-time 토큰 hash 발급
 *
 * 모든 흐름은 [auditChain] 에 AuditEvent 로 기록.
 */
@Service
class TwoFactorService(
    private val repo: TwoFactorSecretRepositoryPort,
    private val kms: KeyManagementService,
    private val tokenStore: TwoFactorTokenStorePort,
    private val rateLimiter: TwoFactorRateLimiterPort,
    private val auditChain: AuditChainService,
    private val metrics: QuantPhase3MetricsPort,
) : ManageTwoFactorUseCase {
    private val random = SecureRandom()

    override suspend fun register(tenantId: TenantId, userId: Long, issuer: String): ManageTwoFactorUseCase.RegistrationResult {
        val secret = ByteArray(SECRET_BYTES).also(random::nextBytes)
        // base32 인코딩은 wipe 하기 전에 수행
        val secretBase32 = Base32.encode(secret)

        val dek = ByteArray(DEK_BYTES).also(random::nextBytes)
        val wrappedDek = kms.wrap(dek)
        val encryptedSecret = AesGcmCipher.encrypt(secret, dek)

        val backupCodesPlain = (1..BACKUP_CODES).map { generateBackupCode() }
        val backupCodesHash = backupCodesPlain.map { sha256Hex(it.toByteArray()) }

        val now = Instant.now()
        val twoFactor = TwoFactorSecret(
            userId = userId,
            encryptedSecret = encryptedSecret,
            encryptedDek = wrappedDek.ciphertext,
            backupCodesHash = backupCodesHash,
            registeredAt = now,
            lastVerifiedAt = null,
        )
        repo.save(twoFactor)

        // 평문 secret / DEK wipe — best-effort (JVM 가 GC 할 때 까지 메모리 잔류 가능성 있음)
        secret.fill(0)
        dek.fill(0)

        audit(
            tenantId,
            AuditEventType.TWO_FA_VERIFIED,
            mapOf("via" to "register", "userId" to userId),
        )
        return ManageTwoFactorUseCase.RegistrationResult(
            otpAuthUri = "otpauth://totp/${issuer}:${tenantId.value}?secret=$secretBase32&issuer=$issuer&algorithm=SHA1&digits=$TOTP_DIGITS&period=30",
            backupCodes = backupCodesPlain,
        )
    }

    override suspend fun verify(tenantId: TenantId, userId: Long, candidate: String): ManageTwoFactorUseCase.VerificationResult {
        if (!rateLimiter.allow(userId)) {
            audit(tenantId, AuditEventType.TWO_FA_FAILED, mapOf("reason" to "rate-limit"))
            metrics.twoFaVerify("failure")
            return ManageTwoFactorUseCase.VerificationResult.RateLimited
        }

        val stored = repo.findByUserId(userId) ?: return ManageTwoFactorUseCase.VerificationResult.NotRegistered.also {
            audit(tenantId, AuditEventType.TWO_FA_FAILED, mapOf("reason" to "not-registered"))
            metrics.twoFaVerify("failure")
        }

        // backup code 시도 (TOTP 길이 6 이 아닌 경우)
        if (candidate.length != TOTP_DIGITS) {
            return tryBackupCode(tenantId, stored, candidate)
        }

        // TOTP 검증 — DEK unwrap + AES-GCM decrypt + verifier
        val secret = decryptSecret(stored)
        val ok = TotpVerifier.verify(secret, candidate, Instant.now().epochSecond)
        secret.fill(0)
        if (!ok) {
            audit(tenantId, AuditEventType.TWO_FA_FAILED, mapOf("reason" to "totp-mismatch"))
            metrics.twoFaVerify("failure")
            return ManageTwoFactorUseCase.VerificationResult.Failed
        }
        return success(tenantId, stored, userId)
    }

    private suspend fun tryBackupCode(
        tenantId: TenantId,
        stored: TwoFactorSecret,
        candidate: String,
    ): ManageTwoFactorUseCase.VerificationResult {
        val candidateHash = sha256Hex(candidate.toByteArray())
        if (candidateHash !in stored.backupCodesHash) {
            audit(tenantId, AuditEventType.TWO_FA_FAILED, mapOf("reason" to "backup-mismatch"))
            metrics.twoFaVerify("failure")
            return ManageTwoFactorUseCase.VerificationResult.Failed
        }
        // 1회용 — hash 제거
        repo.save(stored.consumeBackupCode(candidateHash))
        return success(tenantId, stored, stored.userId, viaBackupCode = true)
    }

    private suspend fun success(
        tenantId: TenantId,
        stored: TwoFactorSecret,
        userId: Long,
        viaBackupCode: Boolean = false,
    ): ManageTwoFactorUseCase.VerificationResult {
        val now = Instant.now()
        repo.save(stored.markVerified(now))
        val token = generateToken(userId, now)
        tokenStore.issue(userId, token, TwoFactorTokenStorePort.DEFAULT_TTL_SECONDS)
        audit(
            tenantId,
            AuditEventType.TWO_FA_VERIFIED,
            mapOf("via" to if (viaBackupCode) "backup-code" else "totp"),
        )
        metrics.twoFaVerify("success")
        return ManageTwoFactorUseCase.VerificationResult.Verified(token, TwoFactorTokenStorePort.DEFAULT_TTL_SECONDS)
    }

    private suspend fun decryptSecret(stored: TwoFactorSecret): ByteArray {
        val wrapped = com.kgd.quant.application.security.port.WrappedDek(
            ciphertext = stored.encryptedDek,
            // KEK 버전 추적은 별도 컬럼 (Phase 3 단순화: KMS 가 ciphertext 에서 버전 인지 가능 가정)
            // 현재 LocalFileKmsAdapter / OciVaultKmsAdapter 는 prefix 또는 헤더에 버전 포함.
            kekVersion = "current",
        )
        return runCatching { kms.unwrap(wrapped) }
            .getOrElse {
                log.error(it) { "kms.unwrap failed for userId=${stored.userId}" }
                throw IllegalStateException("kms unwrap failed", it)
            }.let { dek ->
                val secret = AesGcmCipher.decrypt(stored.encryptedSecret, dek)
                dek.fill(0)
                secret
            }
    }

    private fun generateToken(userId: Long, at: Instant): String {
        val seed = ByteArray(TOKEN_BYTES).also(random::nextBytes)
        return sha256Hex("$userId|${at.toEpochMilli()}|${seed.toHex()}".toByteArray())
    }

    private fun generateBackupCode(): String {
        // 10 자리 random 영숫자 (혼동 방지: I/O/0/1 제외)
        val ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val sb = StringBuilder(BACKUP_CODE_LEN)
        repeat(BACKUP_CODE_LEN) { sb.append(ALPH[random.nextInt(ALPH.length)]) }
        return sb.toString()
    }

    private fun sha256Hex(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(data)
        return digest.toHex()
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

    private suspend fun audit(tenantId: TenantId, type: AuditEventType, payload: Map<String, Any?>) {
        runCatching {
            auditChain.append(tenantId, type, payload)
        }.onFailure { log.warn(it) { "audit append failed (best-effort)" } }
    }

    companion object {
        const val SECRET_BYTES = 32
        const val DEK_BYTES = 32
        const val BACKUP_CODES = 8
        const val BACKUP_CODE_LEN = 10
        const val TOKEN_BYTES = 16
        const val TOTP_DIGITS = 6
    }

    override suspend fun redeemToken(userId: Long, tokenHash: String): Boolean =
        tokenStore.redeem(userId, tokenHash)
}
