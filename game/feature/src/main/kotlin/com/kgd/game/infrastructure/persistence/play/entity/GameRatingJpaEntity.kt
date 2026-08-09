package com.kgd.game.infrastructure.persistence.play.entity

import com.kgd.game.domain.play.model.GameRating
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/**
 * 1표의 주인은 회원 또는 기기 — 재투표는 UPDATE.
 * 유니크 키가 둘인 이유: MySQL 은 UNIQUE 인덱스에서 NULL 중복을 허용하므로
 * 회원 표(device_id NULL)와 기기 표(member_id NULL)가 서로를 막지 않는다.
 */
@Entity
@Table(
    name = "game_rating",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_rating_game_member", columnNames = ["game_id", "member_id"]),
        UniqueConstraint(name = "uk_rating_game_device", columnNames = ["game_id", "device_id"]),
    ],
)
class GameRatingJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(name = "member_id")
    val memberId: Long? = null,
    @Column(name = "device_id", length = 64)
    val deviceId: String? = null,
    score: Int,
) {
    @Column(nullable = false)
    var score: Int = score
        private set

    fun update(rating: GameRating) {
        score = rating.score
    }

    fun toDomain(): GameRating =
        GameRating.restore(id = id, gameId = gameId, memberId = memberId, deviceId = deviceId, score = score)

    companion object {
        fun fromDomain(rating: GameRating): GameRatingJpaEntity =
            GameRatingJpaEntity(
                id = rating.id, gameId = rating.gameId, memberId = rating.memberId,
                deviceId = rating.deviceId, score = rating.score,
            )
    }
}
