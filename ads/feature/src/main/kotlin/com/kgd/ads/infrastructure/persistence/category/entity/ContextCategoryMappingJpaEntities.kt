package com.kgd.ads.infrastructure.persistence.category.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/** FE 문맥 키(`blog:{slug}` 등) → 문맥 카테고리. */
@Entity
@Table(name = "ad_context_mapping")
class ContextMappingJpaEntity(
    @Id
    @Column(name = "context_key", nullable = false, length = 128)
    val contextKey: String,

    @Column(name = "category_code", nullable = false, length = 32)
    val categoryCode: String,

    @Column(name = "updated_by")
    val updatedBy: Long?,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime,
)

/** 매핑이 없는 문맥 키가 가는 호스트 기본 카테고리. */
@Entity
@Table(name = "ad_host_category")
class HostCategoryJpaEntity(
    @Id
    @Column(name = "host", nullable = false, length = 128)
    val host: String,

    @Column(name = "category_code", nullable = false, length = 32)
    val categoryCode: String,

    @Column(name = "updated_by")
    val updatedBy: Long?,

    @Column(name = "updated_at", nullable = false)
    val updatedAt: LocalDateTime,
)
