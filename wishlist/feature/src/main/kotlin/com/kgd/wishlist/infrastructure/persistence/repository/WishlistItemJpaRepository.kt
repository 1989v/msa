package com.kgd.wishlist.infrastructure.persistence.repository

import com.kgd.wishlist.infrastructure.persistence.entity.WishlistItemJpaEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface WishlistItemJpaRepository : JpaRepository<WishlistItemJpaEntity, Long> {
    fun findByMemberId(memberId: Long, pageable: Pageable): List<WishlistItemJpaEntity>
    fun countByMemberId(memberId: Long): Long
    fun existsByMemberIdAndProductId(memberId: Long, productId: Long): Boolean
    fun deleteByMemberIdAndProductId(memberId: Long, productId: Long)

    @Modifying
    @Query("DELETE FROM WishlistItemJpaEntity w WHERE w.memberId = :memberId")
    fun deleteAllByMemberId(memberId: Long)

    @Modifying
    @Query("DELETE FROM WishlistItemJpaEntity w WHERE w.productId = :productId")
    fun deleteAllByProductId(productId: Long)
}
