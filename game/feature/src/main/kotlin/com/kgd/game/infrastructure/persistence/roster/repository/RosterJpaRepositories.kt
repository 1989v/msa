package com.kgd.game.infrastructure.persistence.roster.repository

import com.kgd.game.infrastructure.persistence.roster.entity.FriendGroupJpaEntity
import com.kgd.game.infrastructure.persistence.roster.entity.RosterOptInJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDateTime

interface RosterOptInJpaRepository : JpaRepository<RosterOptInJpaEntity, Long>

interface FriendGroupJpaRepository : JpaRepository<FriendGroupJpaEntity, Long> {
    fun findAllByMemberIdOrderByLastUsedAtDesc(memberId: Long): List<FriendGroupJpaEntity>
    fun findByMemberIdAndName(memberId: Long, name: String): FriendGroupJpaEntity?
    fun deleteByMemberId(memberId: Long): Int
    fun findAllByLastUsedAtBefore(threshold: LocalDateTime): List<FriendGroupJpaEntity>
}
