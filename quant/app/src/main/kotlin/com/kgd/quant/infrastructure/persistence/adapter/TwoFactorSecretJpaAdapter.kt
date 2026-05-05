package com.kgd.quant.infrastructure.persistence.adapter

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.quant.application.port.persistence.TwoFactorSecretRepositoryPort
import com.kgd.quant.domain.twofa.TwoFactorSecret
import com.kgd.quant.infrastructure.persistence.entity.TwoFactorSecretEntity
import com.kgd.quant.infrastructure.persistence.repository.TwoFactorSecretJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component
import kotlin.jvm.optionals.getOrNull

/**
 * TG-P3-09 — TwoFactorSecret JPA 어댑터 (ADR-0037).
 */
@Component
class TwoFactorSecretJpaAdapter(
    private val repo: TwoFactorSecretJpaRepository,
    private val objectMapper: ObjectMapper,
) : TwoFactorSecretRepositoryPort {

    override suspend fun findByUserId(userId: Long): TwoFactorSecret? = withContext(Dispatchers.IO) {
        repo.findById(userId).getOrNull()?.toDomain()
    }

    override suspend fun save(secret: TwoFactorSecret) = withContext(Dispatchers.IO) {
        val entity = repo.findById(secret.userId).orElseGet { TwoFactorSecretEntity(userId = secret.userId) }
        entity.encryptedSecret = secret.encryptedSecret
        entity.encryptedDek = secret.encryptedDek
        entity.backupCodesHashJson = objectMapper.writeValueAsString(secret.backupCodesHash)
        entity.registeredAt = secret.registeredAt
        entity.lastVerifiedAt = secret.lastVerifiedAt
        repo.save(entity)
        Unit
    }

    override suspend fun deleteByUserId(userId: Long) = withContext(Dispatchers.IO) {
        repo.deleteById(userId)
    }

    private val BACKUP_HASH_TYPE = object : TypeReference<List<String>>() {}

    private fun TwoFactorSecretEntity.toDomain(): TwoFactorSecret = TwoFactorSecret(
        userId = userId,
        encryptedSecret = encryptedSecret,
        encryptedDek = encryptedDek,
        backupCodesHash = objectMapper.readValue(backupCodesHashJson, BACKUP_HASH_TYPE),
        registeredAt = registeredAt,
        lastVerifiedAt = lastVerifiedAt,
    )
}
