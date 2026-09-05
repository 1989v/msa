package com.kgd.game.infrastructure.persistence.access.entity

import com.kgd.game.domain.access.model.PrivateGameAccess
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import java.time.LocalDateTime

@Entity
@Table(name = "game_private_access")
class PrivateGameAccessJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_slug", nullable = false, updatable = false, length = 64)
    val gameSlug: String,
    @Column(name = "member_id", nullable = false, updatable = false)
    val memberId: Long,
    @Column(length = 200)
    var note: String? = null,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    fun toDomain() = PrivateGameAccess(id, gameSlug, memberId, note, createdAt)

    companion object {
        fun from(access: PrivateGameAccess) = PrivateGameAccessJpaEntity(
            id = access.id,
            gameSlug = access.gameSlug,
            memberId = access.memberId,
            note = access.note,
        )
    }
}
