package com.kgd.wishlist.infrastructure.persistence.repository

import com.kgd.wishlist.domain.model.WishlistTargetType
import com.kgd.wishlist.infrastructure.persistence.entity.WishlistItemJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface WishlistItemJpaRepository : JpaRepository<WishlistItemJpaEntity, Long> {
    fun findByMemberIdAndTargetTypeAndTargetKey(
        memberId: Long,
        targetType: WishlistTargetType,
        targetKey: String,
    ): WishlistItemJpaEntity?

    /**
     * 타입·묶음으로 좁힌 내 찜 (ADR-0080).
     *
     * 파생 메서드를 조합별로 두지 않는 이유: 타입(2) × 묶음(2) × 미분류(2) = 8종이 되고,
     * 필터가 하나 더 붙을 때마다 배가 된다. 조건을 쿼리 안에서 접는 편이 읽기도 쉽다.
     *
     * `collectionId = null` 은 **전체**이지 미분류가 아니다 — 미분류만 보려면
     * `unclassifiedOnly = true` 다. 둘을 한 파라미터로 겸하면 '지정 안 함' 과
     * '미분류 지정' 이 구분되지 않는다.
     */
    @Query(
        """
        SELECT w FROM WishlistItemJpaEntity w
        WHERE w.memberId = :memberId
          AND (:targetType IS NULL OR w.targetType = :targetType)
          AND (:unclassifiedOnly = FALSE OR w.collectionId IS NULL)
          AND (:collectionId IS NULL OR w.collectionId = :collectionId)
        """,
    )
    fun search(
        memberId: Long,
        targetType: WishlistTargetType?,
        collectionId: Long?,
        unclassifiedOnly: Boolean,
        pageable: Pageable,
    ): List<WishlistItemJpaEntity>

    @Query(
        """
        SELECT COUNT(w) FROM WishlistItemJpaEntity w
        WHERE w.memberId = :memberId
          AND (:targetType IS NULL OR w.targetType = :targetType)
          AND (:unclassifiedOnly = FALSE OR w.collectionId IS NULL)
          AND (:collectionId IS NULL OR w.collectionId = :collectionId)
        """,
    )
    fun countSearch(
        memberId: Long,
        targetType: WishlistTargetType?,
        collectionId: Long?,
        unclassifiedOnly: Boolean,
    ): Long

    /** 묶음별 항목 수 — 목록이 '제주 여행 · 8곳' 을 그리는 데 쓴다 */
    @Query(
        """
        SELECT w.collectionId, COUNT(w) FROM WishlistItemJpaEntity w
        WHERE w.memberId = :memberId AND w.collectionId IS NOT NULL
        GROUP BY w.collectionId
        """,
    )
    fun countGroupedByCollection(memberId: Long): List<Array<Any>>

    @Query("SELECT w.targetKey FROM WishlistItemJpaEntity w WHERE w.memberId = :memberId AND w.targetType = :targetType")
    fun findKeysByMemberIdAndTargetType(memberId: Long, targetType: WishlistTargetType): List<String>

    fun deleteByMemberIdAndTargetTypeAndTargetKey(
        memberId: Long,
        targetType: WishlistTargetType,
        targetKey: String,
    )

    @Modifying
    @Query("DELETE FROM WishlistItemJpaEntity w WHERE w.memberId = :memberId")
    fun deleteAllByMemberId(memberId: Long)

    @Modifying
    @Query("DELETE FROM WishlistItemJpaEntity w WHERE w.targetType = :targetType AND w.targetKey = :targetKey")
    fun deleteAllByTarget(targetType: WishlistTargetType, targetKey: String)
}
