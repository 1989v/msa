package com.kgd.wishlist.domain.model

import java.time.LocalDateTime

/**
 * 찜 대상 종류 (ADR-0074). targetKey 는 대상 서비스의 식별자를 담는 불투명 문자열이다 —
 * game·blog 는 slug, attraction·product 는 숫자 id 의 문자열 표현.
 */
enum class WishlistTargetType {
    PRODUCT,
    GAME,
    ATTRACTION,
    BLOG_POST,
}

class WishlistItem private constructor(
    val id: Long? = null,
    val memberId: Long,
    /**
     * 소속 묶음. `null` 이 곧 미분류다 (ADR-0080) — '기본' 묶음 행을 만들지 않는다.
     *
     * 한 항목은 한 묶음에만 속한다. 다중 소속을 허용하면 하트의 '찜됨/아님' 이진 의미가
     * "어느 묶음에서 찜됨?" 으로 무너진다.
     */
    private var _collectionId: Long? = null,
    val targetType: WishlistTargetType,
    val targetKey: String,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    val collectionId: Long? get() = _collectionId

    /** 묶음 이동 — 해제는 null 이다(찜 자체는 남는다) */
    fun moveTo(collectionId: Long?) {
        _collectionId = collectionId
    }

    companion object {
        const val MAX_TARGET_KEY_LENGTH = 120

        fun create(
            memberId: Long,
            targetType: WishlistTargetType,
            targetKey: String,
            collectionId: Long? = null,
        ): WishlistItem {
            require(memberId > 0) { "회원 ID는 0보다 커야 합니다" }
            require(targetKey.isNotBlank()) { "대상 키는 비어 있을 수 없습니다" }
            require(targetKey.length <= MAX_TARGET_KEY_LENGTH) {
                "대상 키는 ${MAX_TARGET_KEY_LENGTH}자를 넘을 수 없습니다"
            }
            return WishlistItem(
                memberId = memberId,
                _collectionId = collectionId,
                targetType = targetType,
                targetKey = targetKey,
            )
        }

        fun restore(
            id: Long?,
            memberId: Long,
            collectionId: Long?,
            targetType: WishlistTargetType,
            targetKey: String,
            createdAt: LocalDateTime,
        ): WishlistItem = WishlistItem(
            id = id,
            memberId = memberId,
            _collectionId = collectionId,
            targetType = targetType,
            targetKey = targetKey,
            createdAt = createdAt,
        )
    }
}
