package com.kgd.game.infrastructure.persistence.catalog.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

/**
 * 게임-태그 N:M 매핑 (FK-as-ID). 태그 교집합 기반 "More Games Like This" 조회의 조인 축.
 * Game.tags(json) 는 노출용 스냅샷, 이 테이블이 조회용 정규화 뷰 — 어댑터 save 시 동기화.
 */
@Entity
@Table(
    name = "game_tag_map",
    uniqueConstraints = [UniqueConstraint(name = "uk_game_tag", columnNames = ["game_id", "tag_slug"])],
)
class GameTagMapJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "game_id", nullable = false)
    val gameId: Long,
    @Column(name = "tag_slug", nullable = false, length = 50)
    val tagSlug: String,
)
