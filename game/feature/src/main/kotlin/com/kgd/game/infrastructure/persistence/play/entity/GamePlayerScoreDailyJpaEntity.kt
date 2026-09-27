package com.kgd.game.infrastructure.persistence.play.entity

import com.kgd.game.domain.play.model.ScoreTrack
import jakarta.persistence.Column
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
import java.time.LocalDate
import java.time.LocalDateTime

/** Account-owned score; player_id is projected from the current profile. */
@Entity
@Table(
    name = "game_player_score_daily",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_player_score_daily_game_track_board_date_nick",
            columnNames = ["game_id", "track", "board", "play_date", "player_id"],
        ),
    ],
)
class GamePlayerScoreDailyJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    val track: ScoreTrack = ScoreTrack.BASE,
    /** 역대 보드와 같은 모드 축 (V59). 한쪽에만 있으면 "오늘의 1위"가 모드를 섞는다 */
    @Column(nullable = false, length = 24)
    val board: String = "",
    @Column(name = "play_date", nullable = false)
    val playDate: LocalDate,
    @Column(nullable = false, name = "player_id", length = 36)
    val playerId: String,
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

    /** 그날의 기존 기록보다 높을 때만 반영한다 */
    fun updateIfHigher(score: Long, detail: String?): Boolean {
        if (score <= this.score) return false
        this.score = score
        this.detail = detail
        return true
    }
}
