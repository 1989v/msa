package com.kgd.game.infrastructure.persistence.play.entity

import com.kgd.game.domain.play.model.GameRating
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/** 1인 1표 — unique(game_id, member_id), 재투표는 UPDATE */
@Entity
@Table(
    name = "game_rating",
    uniqueConstraints = [UniqueConstraint(name = "uk_rating_game_member", columnNames = ["game_id", "member_id"])],
)
class GameRatingJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    score: Int,
) {
    @Column(nullable = false)
    var score: Int = score
        private set

    fun update(rating: GameRating) {
        score = rating.score
    }

    fun toDomain(): GameRating = GameRating.restore(id = id, gameId = gameId, memberId = memberId, score = score)

    companion object {
        fun fromDomain(rating: GameRating): GameRatingJpaEntity =
            GameRatingJpaEntity(id = rating.id, gameId = rating.gameId, memberId = rating.memberId, score = rating.score)
    }
}
