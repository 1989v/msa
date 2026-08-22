package com.kgd.wishlist.application.wishlist.port

import com.kgd.wishlist.domain.model.WishlistCollection
import com.kgd.wishlist.domain.model.WishlistItem
import com.kgd.wishlist.domain.model.WishlistTargetType

interface WishlistRepositoryPort {
    fun save(item: WishlistItem): WishlistItem
    fun findByMemberAndTarget(memberId: Long, targetType: WishlistTargetType, targetKey: String): WishlistItem?
    fun deleteByMemberAndTarget(memberId: Long, targetType: WishlistTargetType, targetKey: String)
    /**
     * [collectionId] 로 좁힌다 (ADR-0080). `null` 은 **전체**이지 미분류가 아니다 —
     * 미분류만 보려면 [unclassifiedOnly] 를 쓴다. 둘을 한 파라미터로 겸하면
     * '지정 안 함' 과 '미분류 지정' 이 구분되지 않는다.
     */
    fun findByMember(
        memberId: Long,
        targetType: WishlistTargetType?,
        collectionId: Long?,
        unclassifiedOnly: Boolean,
        page: Int,
        size: Int,
    ): List<WishlistItem>
    fun countByMember(
        memberId: Long,
        targetType: WishlistTargetType?,
        collectionId: Long?,
        unclassifiedOnly: Boolean,
    ): Long
    fun findKeysByMemberAndType(memberId: Long, targetType: WishlistTargetType): List<String>
    fun deleteAllByMemberId(memberId: Long)
    fun deleteAllByTarget(targetType: WishlistTargetType, targetKey: String)

    // ── 묶음 (ADR-0080) ───────────────────────────────────────────────────
    fun saveCollection(collection: WishlistCollection): WishlistCollection
    fun findCollections(memberId: Long): List<WishlistCollection>
    fun findCollection(id: Long, memberId: Long): WishlistCollection?
    fun deleteCollection(id: Long, memberId: Long)
    /** 묶음별 항목 수 — 목록 화면이 '제주 여행 · 8곳' 을 그리는 데 쓴다 */
    fun countByCollection(memberId: Long): Map<Long, Long>
}
