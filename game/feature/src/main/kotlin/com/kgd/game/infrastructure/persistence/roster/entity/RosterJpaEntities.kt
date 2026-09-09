package com.kgd.game.infrastructure.persistence.roster.entity

import com.kgd.game.domain.roster.model.FriendGroup
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "party_roster_optin")
class RosterOptInJpaEntity(
    @Id
    @Column(name = "member_id", nullable = false, updatable = false)
    val memberId: Long,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
)

/**
 * 별칭은 그룹에 종속된 값이라 **연관관계를 쓴다** — FK-as-ID 정책의 예외다.
 * 그룹을 지우면 별칭도 함께 사라져야 하고, 별칭만 따로 조회할 일이 없다.
 */
@Entity
@Table(name = "party_friend_group")
class FriendGroupJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "member_id", nullable = false, updatable = false)
    val memberId: Long,
    name: String,
    lastUsedAt: LocalDateTime,
) {
    @Column(nullable = false, length = 24)
    var name: String = name
        private set

    @Column(name = "last_used_at", nullable = false)
    var lastUsedAt: LocalDateTime = lastUsedAt
        private set

    @OneToMany(cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "group_id", nullable = false)
    @OrderBy("sortOrder ASC")
    var aliases: MutableList<FriendAliasJpaEntity> = mutableListOf()
        private set

    /** 전체 동기화 — 이름·별칭·사용시각을 한 번에 맞춘다 (부분 수정과 섞지 않는다) */
    fun sync(group: FriendGroup) {
        name = group.name
        lastUsedAt = group.lastUsedAt
        aliases.clear()
        aliases.addAll(group.aliases.mapIndexed { i, a -> FriendAliasJpaEntity(alias = a, sortOrder = i) })
    }

    fun toDomain() = FriendGroup(
        id = id,
        memberId = memberId,
        name = name,
        aliases = aliases.map { it.alias },
        lastUsedAt = lastUsedAt,
    )

    companion object {
        fun from(group: FriendGroup) =
            FriendGroupJpaEntity(null, group.memberId, group.name, group.lastUsedAt)
                .apply { sync(group) }
    }
}

@Entity
@Table(name = "party_friend_group_member")
class FriendAliasJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, length = 12)
    val alias: String,
    @Column(name = "sort_order", nullable = false)
    val sortOrder: Int,
)
