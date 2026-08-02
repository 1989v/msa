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

/** 클라우드 세이브 — 게임이 정의하는 불투명 JSON blob, @Version 낙관적 락 (설계 §4.2) */
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
    @Column(name = "member_id", nullable = false)
    val memberId: Long,
    data: String,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
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
}
