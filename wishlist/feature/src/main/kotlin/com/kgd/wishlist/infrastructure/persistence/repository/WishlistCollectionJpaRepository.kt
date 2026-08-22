package com.kgd.wishlist.infrastructure.persistence.repository

import com.kgd.wishlist.infrastructure.persistence.entity.WishlistCollectionJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface WishlistCollectionJpaRepository : JpaRepository<WishlistCollectionJpaEntity, Long> {
    fun findAllByMemberIdOrderByCreatedAtAsc(memberId: Long): List<WishlistCollectionJpaEntity>
    fun findByIdAndMemberId(id: Long, memberId: Long): WishlistCollectionJpaEntity?
    fun existsByMemberIdAndName(memberId: Long, name: String): Boolean
    fun deleteAllByMemberId(memberId: Long)
}
