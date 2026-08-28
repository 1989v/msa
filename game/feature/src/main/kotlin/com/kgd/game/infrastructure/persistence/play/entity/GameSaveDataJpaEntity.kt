package com.kgd.game.infrastructure.persistence.play.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import jakarta.persistence.Version
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDateTime

/**
 * 클라우드 세이브 — 게임이 정의하는 불투명 JSON blob, @Version 낙관적 락 (설계 §4.2).
 * 로그인 사용자는 memberId 로, 게스트는 saveCode 로 자기 세이브를 찾는다.
 */
@Entity
@Table(
    name = "game_save_data",
    uniqueConstraints = [UniqueConstraint(name = "uk_save_game_member", columnNames = ["game_id", "member_id"])],
)
class GameSaveDataJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    memberId: Long? = null,
    /** 이어하기 코드 — 브라우저 저장소를 잃어도 이 코드로 복구한다 */
    @Column(name = "save_code", length = 16, unique = true)
    val saveCode: String? = null,
    data: String,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(name = "member_id")
    var memberId: Long? = memberId
        private set

    @Column(nullable = false, columnDefinition = "json")
    var data: String = data
        private set

    @Version
    @Column(nullable = false)
    var version: Long = 0
        private set

    fun updateData(data: String) {
        this.data = data
    }

    /**
     * 게스트로 쌓은 세이브를 계정 슬롯으로 옮긴다.
     *
     * 게임당 슬롯은 하나이므로 **계정 슬롯이 비어 있을 때만** 호출한다 — 계정에 이미
     * 진행도가 있으면 그것이 이기고, 게스트 행은 코드로 계속 열린다.
     */
    fun claimBy(memberId: Long) {
        this.memberId = memberId
    }
}
