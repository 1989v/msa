package com.kgd.quant.application.port.persistence

import com.kgd.quant.domain.twofa.TwoFactorSecret

/**
 * TwoFactorSecretRepositoryPort — `two_fa_secret` 테이블 access port (ADR-0037 / TG-P3-09).
 */
interface TwoFactorSecretRepositoryPort {
    suspend fun findByUserId(userId: Long): TwoFactorSecret?
    suspend fun save(secret: TwoFactorSecret)
    suspend fun deleteByUserId(userId: Long)
}
