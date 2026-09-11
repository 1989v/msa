package com.kgd.place.infrastructure.persistence.attraction.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Lob
import jakarta.persistence.Table
import java.time.LocalDateTime

/**
 * 임베딩 벡터 행 (ADR-0090). 컬럼 정의는 `V12__create_attraction_embedding.sql` 이 SSOT.
 *
 * `vector` 는 바이트로만 들고 있다 — float 변환은 어댑터가 한다(엔티티에 도메인 변환을 두지 않는다).
 */
@Entity
@Table(name = "attraction_embedding")
class AttractionEmbeddingJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "attraction_id", nullable = false)
    val attractionId: Long,

    @Column(name = "model_ref", nullable = false, length = 160)
    val modelRef: String,

    @Column(nullable = false)
    val dim: Short,

    @Column(name = "embedding_text", nullable = false, columnDefinition = "TEXT")
    val embeddingText: String,

    @Column(name = "text_hash", nullable = false, length = 64)
    val textHash: String,

    @Lob
    @Column(nullable = false, columnDefinition = "BLOB")
    val vector: ByteArray,

    @Column(name = "embedded_at", nullable = false)
    val embeddedAt: LocalDateTime,
)
