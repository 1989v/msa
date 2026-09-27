package com.kgd.game.infrastructure.persistence.profile.repository

import com.kgd.game.infrastructure.persistence.profile.entity.GamePlayerProfileJpaEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query

interface GamePlayerProfileJpaRepository : JpaRepository<GamePlayerProfileJpaEntity, String> {
    fun findByMemberId(memberId: Long): GamePlayerProfileJpaEntity?
    fun findByGuestTokenHash(guestTokenHash: String): GamePlayerProfileJpaEntity?
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from GamePlayerProfileJpaEntity p where p.memberId = :memberId")
    fun lockMember(memberId: Long): GamePlayerProfileJpaEntity?
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from GamePlayerProfileJpaEntity p where p.guestTokenHash = :hash")
    fun lockGuest(hash: String): GamePlayerProfileJpaEntity?
}
