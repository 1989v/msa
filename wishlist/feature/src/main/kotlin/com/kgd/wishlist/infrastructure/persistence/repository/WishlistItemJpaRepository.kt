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

    fun findByMemberId(memberId: Long, pageable: Pageable): List<WishlistItemJpaEntity>
    fun findByMemberIdAndTargetType(
        memberId: Long,
        targetType: WishlistTargetType,
        pageable: Pageable,
    ): List<WishlistItemJpaEntity>

    fun countByMemberId(memberId: Long): Long
    fun countByMemberIdAndTargetType(memberId: Long, targetType: WishlistTargetType): Long

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
