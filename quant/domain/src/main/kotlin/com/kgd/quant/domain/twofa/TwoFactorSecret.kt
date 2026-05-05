package com.kgd.quant.domain.twofa

import java.time.Instant

/**
 * TwoFactorSecret — TOTP (RFC 6238) 사용자 시드 + 백업 코드 hash (ADR-0037 Phase 3 / TG-P3-09).
 *
 * 도메인 레이어는 식별 + invariant 만 보유. 암복호화 / DB / Redis 는 인프라 레이어.
 *
 * - encryptedSecret: AES-256-GCM 으로 암호화된 TOTP secret (32 bytes 평문 → ciphertext)
 * - encryptedDek: KEK 로 envelope 암호화된 DEK (KMS port 가 unwrap)
 * - backupCodesHash: 8 개 1회용 백업 코드의 SHA-256 hex 리스트
 *
 * 라이프사이클:
 * - registered (생성)
 * - verified (TOTP 1회 성공) — last_verified_at 갱신
 * - revoked (사용자 해지 시 별도 row 삭제 — 도메인은 모름)
 */
data class TwoFactorSecret(
    val userId: Long,
    val encryptedSecret: ByteArray,
    val encryptedDek: ByteArray,
    val backupCodesHash: List<String>,
    val registeredAt: Instant,
    val lastVerifiedAt: Instant?,
) {
    init {
        require(encryptedSecret.isNotEmpty()) { "encryptedSecret must not be empty" }
        require(encryptedDek.isNotEmpty()) { "encryptedDek must not be empty" }
        require(backupCodesHash.size in BACKUP_CODE_RANGE) {
            "backupCodesHash size must be in $BACKUP_CODE_RANGE (got ${backupCodesHash.size})"
        }
        require(backupCodesHash.all { it.length == 64 }) {
            "all backupCodesHash must be SHA-256 hex (64 chars)"
        }
    }

    /** 백업 코드 1개 사용 후 — 해당 hash 제거된 새 인스턴스 반환. */
    fun consumeBackupCode(usedCodeHash: String): TwoFactorSecret {
        require(usedCodeHash in backupCodesHash) {
            "usedCodeHash not in current backup codes"
        }
        return copy(backupCodesHash = backupCodesHash - usedCodeHash)
    }

    fun markVerified(at: Instant): TwoFactorSecret = copy(lastVerifiedAt = at)

    // data class equals — ByteArray 비교는 reference 라 명시 정의
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is TwoFactorSecret) return false
        if (userId != other.userId) return false
        if (!encryptedSecret.contentEquals(other.encryptedSecret)) return false
        if (!encryptedDek.contentEquals(other.encryptedDek)) return false
        if (backupCodesHash != other.backupCodesHash) return false
        if (registeredAt != other.registeredAt) return false
        if (lastVerifiedAt != other.lastVerifiedAt) return false
        return true
    }

    override fun hashCode(): Int {
        var result = userId.hashCode()
        result = 31 * result + encryptedSecret.contentHashCode()
        result = 31 * result + encryptedDek.contentHashCode()
        result = 31 * result + backupCodesHash.hashCode()
        result = 31 * result + registeredAt.hashCode()
        result = 31 * result + (lastVerifiedAt?.hashCode() ?: 0)
        return result
    }

    companion object {
        val BACKUP_CODE_RANGE = 0..8           // 발급 시 8개, 소비 시 0~7
        const val REGISTERED_BACKUP_CODES = 8
    }
}
