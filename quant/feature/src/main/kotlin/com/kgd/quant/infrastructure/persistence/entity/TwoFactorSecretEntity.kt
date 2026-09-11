package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * TG-P3-09 — `two_fa_secret` JPA Entity (ADR-0037).
 *
 * encrypted_secret / encrypted_dek 는 envelope 암호화된 ByteArray.
 * backup_codes_hash 는 8개 SHA-256 hex 의 JSON 배열 (1회용 — 사용 시 제거).
 */
@Entity
@Table(name = "two_fa_secret")
class TwoFactorSecretEntity(
    @Id
    @Column(name = "user_id")
    var userId: Long = 0L,

    @Column(name = "encrypted_secret", nullable = false, length = 255)
    var encryptedSecret: ByteArray = ByteArray(0),

    @Column(name = "encrypted_dek", nullable = false, length = 255)
    var encryptedDek: ByteArray = ByteArray(0),

    @Column(name = "backup_codes_hash", nullable = false, columnDefinition = "JSON")
    var backupCodesHashJson: String = "[]",

    @Column(name = "registered_at", nullable = false)
    var registeredAt: Instant = Instant.EPOCH,

    @Column(name = "last_verified_at")
    var lastVerifiedAt: Instant? = null,
)
