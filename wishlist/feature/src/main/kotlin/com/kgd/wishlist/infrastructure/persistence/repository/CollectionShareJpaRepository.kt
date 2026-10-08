package com.kgd.wishlist.infrastructure.persistence.repository

import com.kgd.wishlist.infrastructure.persistence.entity.CollectionShareJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface CollectionShareJpaRepository : JpaRepository<CollectionShareJpaEntity, Long> {
    fun findByToken(token: String): CollectionShareJpaEntity?

    fun findAllByCollectionIdAndRevokedAtIsNull(collectionId: Long): List<CollectionShareJpaEntity>

    @Modifying
    @Query("DELETE FROM CollectionShareJpaEntity s WHERE s.memberId = :memberId")
    fun deleteAllByMemberId(memberId: Long)
}
