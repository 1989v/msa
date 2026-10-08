package com.kgd.wishlist.infrastructure.persistence.repository

import com.kgd.wishlist.infrastructure.persistence.entity.WishlistCollectionJpaEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query

interface WishlistCollectionJpaRepository : JpaRepository<WishlistCollectionJpaEntity, Long> {
    fun findAllByMemberIdOrderByCreatedAtAsc(memberId: Long): List<WishlistCollectionJpaEntity>
    fun findByIdAndMemberId(id: Long, memberId: Long): WishlistCollectionJpaEntity?

    /**
     * 소유 묶음을 쓰기 잠금으로 읽는다 — 공유 링크 생성·폐기가 이 행에서 줄을 선다.
     * 「살아 있는 링크는 묶음당 하나」를 스키마가 강제하지 못해서다 (ADR-0107).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM WishlistCollectionJpaEntity c WHERE c.id = :id AND c.memberId = :memberId")
    fun findForUpdateByIdAndMemberId(id: Long, memberId: Long): WishlistCollectionJpaEntity?
    fun existsByMemberIdAndName(memberId: Long, name: String): Boolean
    fun deleteAllByMemberId(memberId: Long)
}
