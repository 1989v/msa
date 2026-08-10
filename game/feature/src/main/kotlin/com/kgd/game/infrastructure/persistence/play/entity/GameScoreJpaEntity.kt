package com.kgd.game.infrastructure.persistence.play.entity

import jakarta.persistence.Column
import com.kgd.game.domain.play.model.ScoreTrack
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDateTime

/** 게임별 랭킹 — **트랙 안에서** 닉네임당 최고 기록 1행 (더 높은 점수일 때만 갱신) */
@Entity
@Table(
    name = "game_score",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_score_game_track_nick", columnNames = ["game_id", "track", "nickname"]),
    ],
)
class GameScoreJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(nullable = false, length = 24)
    val nickname: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    val track: ScoreTrack = ScoreTrack.BASE,
    score: Long,
    detail: String?,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(nullable = false)
    var score: Long = score
        private set

    @Column(length = 64)
    var detail: String? = detail
        private set

    /** 기존 기록보다 높을 때만 반영한다 */
    fun updateIfHigher(score: Long, detail: String?): Boolean {
        if (score <= this.score) return false
        this.score = score
        this.detail = detail
        return true
    }
}
