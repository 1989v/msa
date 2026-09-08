package com.kgd.place.infrastructure.persistence.attraction.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 분류체계 코드 행. 컬럼 정의는 `V13__create_attraction_category_code.sql` 이 SSOT. */
@Entity
@Table(name = "attraction_category_codes")
class AttractionCategoryCodeJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 8)
    val lang: String,

    @Column(nullable = false, length = 16)
    val code: String,

    @Column(nullable = false)
    val depth: Int,

    @Column(name = "parent_code", length = 16)
    val parentCode: String? = null,

    @Column(nullable = false, length = 160)
    val name: String,

    @Column(name = "synced_at", nullable = false)
    val syncedAt: LocalDateTime = LocalDateTime.now(),
)
