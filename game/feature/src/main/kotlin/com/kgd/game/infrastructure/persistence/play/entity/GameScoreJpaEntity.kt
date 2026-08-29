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

/**
 * 게임별 랭킹 — **한 보드 안에서** 닉네임당 최고 기록 1행 (더 높은 점수일 때만 갱신).
 *
 * 보드를 정하는 축이 둘이다: 트랙(무강화/강화 — 플랫폼이 정한 값)과 보드(게임이 나눈 모드,
 * V59). 빈 보드 키가 기본이고, 모드를 나누지 않는 게임은 계속 그 한 보드를 쓴다.
 */
@Entity
@Table(
    name = "game_score",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_score_game_track_board_nick",
            columnNames = ["game_id", "track", "board", "nickname"],
        ),
    ],
)
class GameScoreJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(nullable = false, length = 24)
    val nickname: String,
    /**
     * 제출 당시 로그인 회원. 게스트 제출을 계속 허용하므로 nullable 이다.
     * 유일성은 여전히 (게임, 트랙, 보드, 닉네임) 이 갖는다 — 회원을 키에 넣으면
     * 같은 사람이 닉네임을 바꿀 때마다 행이 늘어난다.
     */
    @Column(name = "member_id")
    var memberId: Long? = null,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    val track: ScoreTrack = ScoreTrack.BASE,
    /** 게임이 정한 모드 키. 빈 문자열이 "모드를 나누지 않음"이다 (ScoreBoardKey.DEFAULT) */
    @Column(nullable = false, length = 24)
    val board: String = "",
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
