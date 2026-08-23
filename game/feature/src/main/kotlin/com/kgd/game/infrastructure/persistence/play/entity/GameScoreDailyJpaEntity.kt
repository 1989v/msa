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

/**
 * 오늘의 기록 — **하루 안에서** 닉네임당 최고 1행.
 *
 * 역대 보드(`GameScoreJpaEntity`)와 규칙이 같고 축만 하나 늘었다. 파생 테이블이 아니라
 * 별도 원장인 이유는 V49 헤더 참조 — 역대 보드에는 자기 최고를 넘지 못한 런이 남지 않는다.
 *
 * `playDate` 는 KST 로 계산된 결과만 담는다 (`GameDay`). 시각이 아니라 날짜라 DATE 로 둔다.
 */
@Entity
@Table(
    name = "game_score_daily",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_score_daily_game_track_date_nick",
            columnNames = ["game_id", "track", "play_date", "nickname"],
        ),
    ],
)
class GameScoreDailyJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    val track: ScoreTrack = ScoreTrack.BASE,
    @Column(name = "play_date", nullable = false)
    val playDate: LocalDate,
    @Column(nullable = false, length = 24)
    val nickname: String,
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
