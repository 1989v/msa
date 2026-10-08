package com.kgd.wishlist.domain.model

import java.security.SecureRandom
import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * 묶음 공유 링크 (ADR-0107) — 토큰을 아는 사람은 로그인 없이 묶음을 읽는다.
 *
 * 토큰은 추측할 수 없어야 하므로 SecureRandom 으로 만든다. 영숫자 10자(62^10)는
 * 단축 주소 `/c/{token}` 에 그대로 들어가는 길이다.
 *
 * 살아 있음은 열람 시점에 판정한다 — 만료를 배치로 지우지 않으므로 행이 남아 있어도
 * [isAlive] 가 거짓이면 없는 링크와 같게 다룬다. 시각은 전부 인자로 받는다.
 */
class CollectionShare private constructor(
    val id: Long? = null,
    val collectionId: Long,
    val memberId: Long,
    val token: String,
    val createdAt: Instant,
    val expiresAt: Instant?,
    private var _revokedAt: Instant?,
) {
    val revokedAt: Instant? get() = _revokedAt

    companion object {
        const val TOKEN_LENGTH = 10
        val TOKEN_PATTERN = Regex("^[A-Za-z0-9]{$TOKEN_LENGTH}$")
        const val DEFAULT_EXPIRES_IN_DAYS = 30
        const val MIN_EXPIRES_IN_DAYS = 1
        const val MAX_EXPIRES_IN_DAYS = 365

        private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        private val random = SecureRandom()

        /** @param expiresInDays null 이면 만료 없음. */
        fun create(
            collectionId: Long,
            memberId: Long,
            expiresInDays: Int? = DEFAULT_EXPIRES_IN_DAYS,
            clock: Clock,
        ): CollectionShare {
            require(collectionId > 0) { "묶음 ID는 0보다 커야 합니다" }
            require(memberId > 0) { "회원 ID는 0보다 커야 합니다" }
            require(expiresInDays == null || expiresInDays in MIN_EXPIRES_IN_DAYS..MAX_EXPIRES_IN_DAYS) {
                "만료 일수는 $MIN_EXPIRES_IN_DAYS~$MAX_EXPIRES_IN_DAYS 사이여야 합니다"
            }
            val now = clock.instant()
            return CollectionShare(
                collectionId = collectionId,
                memberId = memberId,
                token = newToken(),
                createdAt = now,
                expiresAt = expiresInDays?.let { now.plus(Duration.ofDays(it.toLong())) },
                _revokedAt = null,
            )
        }

        fun restore(
            id: Long?,
            collectionId: Long,
            memberId: Long,
            token: String,
            createdAt: Instant,
            expiresAt: Instant?,
            revokedAt: Instant?,
        ): CollectionShare = CollectionShare(
            id = id,
            collectionId = collectionId,
            memberId = memberId,
            token = token,
            createdAt = createdAt,
            expiresAt = expiresAt,
            _revokedAt = revokedAt,
        )

        private fun newToken(): String =
            String(CharArray(TOKEN_LENGTH) { ALPHABET[random.nextInt(ALPHABET.length)] })
    }

    /** 만료 시각과 같은 순간부터 죽은 링크다. */
    fun isAlive(now: Instant): Boolean =
        _revokedAt == null && (expiresAt == null || now.isBefore(expiresAt))

    /** 멱등 — 이미 폐기됐으면 처음 시각을 남긴다. */
    fun revoke(now: Instant) {
        if (_revokedAt == null) _revokedAt = now
    }
}
