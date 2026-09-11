package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.ExchangeCredentialEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

/**
 * TG-P2-04 — `exchange_credential` JpaRepository.
 *
 * - `findByCredentialIdAndTenantId` 로 INV-05 (tenantId 격리) 강제.
 * - `findTop100ByKekVersionLessThanOrderByCreatedAtAsc` 는 [com.kgd.quant.infrastructure.security.LazyReencryptionJob]
 *   가 stale row 를 100건씩 polling 하는 데 사용. `idx_exchange_credential_kek_version` 인덱스 활용.
 * - [updateEnvelopeWithLock] 는 optimistic lock 기반 envelope 갱신:
 *   `WHERE id=? AND kek_version=oldVer` 절로 동시 갱신 충돌 시 update count = 0 → 잡이 silent skip.
 */
interface ExchangeCredentialJpaRepository : JpaRepository<ExchangeCredentialEntity, UUID> {

    fun findByCredentialIdAndTenantId(credentialId: UUID, tenantId: String): ExchangeCredentialEntity?

    fun findAllByTenantId(tenantId: String): List<ExchangeCredentialEntity>

    /** 회전 중인 KEK 버전보다 낮은 row 100건. Phase 1 fallback row 도 함께 회수된다 (kek_version=1 default). */
    fun findTop100ByKekVersionLessThanOrderByCreatedAtAsc(targetVersion: Int): List<ExchangeCredentialEntity>

    /**
     * Optimistic lock 기반 envelope 컬럼 갱신.
     *
     * @return 1 = 성공, 0 = 동시 갱신 충돌 (다른 잡 인스턴스가 먼저 갱신함 → silent skip).
     */
    @Modifying
    @Query(
        "UPDATE ExchangeCredentialEntity e SET " +
            "e.apiKeyCipher = :apiKeyCt, " +
            "e.apiSecretCipher = :apiSecretCt, " +
            "e.passphraseCipher = :passphraseCt, " +
            "e.dekWrapped = :dekWrapped, " +
            "e.kekVersion = :newVersion " +
            "WHERE e.credentialId = :credentialId AND e.kekVersion = :expectedOldVersion"
    )
    fun updateEnvelopeWithLock(
        @Param("credentialId") credentialId: UUID,
        @Param("expectedOldVersion") expectedOldVersion: Int,
        @Param("apiKeyCt") apiKeyCt: ByteArray,
        @Param("apiSecretCt") apiSecretCt: ByteArray,
        @Param("passphraseCt") passphraseCt: ByteArray?,
        @Param("dekWrapped") dekWrapped: ByteArray,
        @Param("newVersion") newVersion: Int
    ): Int
}
