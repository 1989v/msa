package com.kgd.wishlist.domain.model

import java.time.LocalDateTime

/**
 * 찜 묶음 (ADR-0080) — 관광지를 여행 단위로 모은다.
 *
 * 대상 타입을 갖지 않는다. 스키마는 범용으로 두되 그룹 선택 **UI 만** 관광지에 노출하는데,
 * 나중에 다른 타입이 묶음을 원할 때 두 번째 마이그레이션을 하지 않기 위해서다 — 여기에
 * 타입 컬럼을 두면 그때 스키마를 다시 건드려야 한다.
 *
 * '기본' 묶음이라는 개념이 없다. 미분류는 `WishlistItem.collectionId == null` 이고,
 * 그래서 이 클래스에는 그 상태가 나타나지 않는다.
 */
class WishlistCollection private constructor(
    val id: Long? = null,
    val memberId: Long,
    private var _name: String,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    val name: String get() = _name

    companion object {
        const val MAX_NAME_LENGTH = 40

        fun create(memberId: Long, name: String): WishlistCollection {
            require(memberId > 0) { "회원 ID는 0보다 커야 합니다" }
            return WishlistCollection(memberId = memberId, _name = validName(name))
        }

        fun restore(
            id: Long?,
            memberId: Long,
            name: String,
            createdAt: LocalDateTime,
        ): WishlistCollection = WishlistCollection(
            id = id,
            memberId = memberId,
            _name = name,
            createdAt = createdAt,
        )

        private fun validName(name: String): String {
            val trimmed = name.trim()
            require(trimmed.isNotBlank()) { "묶음 이름은 비어 있을 수 없습니다" }
            require(trimmed.length <= MAX_NAME_LENGTH) {
                "묶음 이름은 ${MAX_NAME_LENGTH}자를 넘을 수 없습니다"
            }
            return trimmed
        }
    }

    fun rename(name: String) {
        _name = validName(name)
    }
}
