package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

/**
 * IndicatorContentEntity — `indicator_content` 테이블 매핑 (V20260504_002).
 *
 * `examples_json` 은 [com.kgd.quant.domain.learn.IndicatorExample] 리스트의 JSON 직렬화.
 */
@Entity
@Table(name = "indicator_content")
class IndicatorContentEntity(
    @Id
    @Column(name = "content_id", columnDefinition = "BINARY(16)", nullable = false)
    var contentId: UUID = UUID.randomUUID(),

    @Column(name = "slug", nullable = false, length = 64, unique = true)
    var slug: String = "",

    @Column(name = "title", nullable = false, length = 255)
    var title: String = "",

    @Column(name = "category", nullable = false, length = 32)
    var category: String = "",

    @Column(name = "summary", nullable = false, length = 500)
    var summary: String = "",

    @Column(name = "body_md", nullable = false, columnDefinition = "MEDIUMTEXT")
    var bodyMd: String = "",

    @Column(name = "formula_tex", nullable = true, columnDefinition = "TEXT")
    var formulaTex: String? = null,

    @Column(name = "examples_json", nullable = false, columnDefinition = "JSON")
    var examplesJson: String = "[]",

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),

    @Column(name = "published_at", nullable = true)
    var publishedAt: Instant? = null,
)
