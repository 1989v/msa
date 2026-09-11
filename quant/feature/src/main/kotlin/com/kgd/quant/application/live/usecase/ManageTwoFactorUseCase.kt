package com.kgd.quant.application.live.usecase

import com.kgd.quant.application.live.port.TwoFactorSecretRepositoryPort
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

/** 2FA 등록·검증·토큰 소진 (RFC 6238, ADR-0037). */
interface ManageTwoFactorUseCase {
    suspend fun register(tenantId: TenantId, userId: Long, issuer: String = "quant"): RegistrationResult
    suspend fun verify(tenantId: TenantId, userId: Long, candidate: String): VerificationResult

    /** 1회용 2FA 토큰 소진. 이미 쓴 토큰이면 false — 재사용을 막는 것이 이 메서드의 존재 이유다. */
    suspend fun redeemToken(userId: Long, tokenHash: String): Boolean

    sealed interface VerificationResult {
        data class Verified(val tokenHash: String, val expiresInSeconds: Long) : VerificationResult
        data object Failed : VerificationResult
        data object RateLimited : VerificationResult
        data object NotRegistered : VerificationResult
    }

    data class RegistrationResult(val otpAuthUri: String, val backupCodes: List<String>)
}
