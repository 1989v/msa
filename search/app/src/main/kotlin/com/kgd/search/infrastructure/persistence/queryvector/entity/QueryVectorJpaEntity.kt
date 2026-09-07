package com.kgd.search.infrastructure.persistence.queryvector.entity

import com.kgd.search.domain.queryvector.model.QueryVector
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.time.LocalDateTime

/**
 * 질의 벡터 원천 행 (ADR-0090).
 *
 * 벡터를 `VARBINARY` 로 담는다 — DB 가 이 값을 계산에 쓰지 않으므로 문자열로 바꿀 이유가 없고,
 * float32 640개는 2,560바이트인데 JSON 으로 담으면 3배가 된다.
 * **바이트 순서는 little-endian 으로 고정한다** — 도구·서버·사이드카가 같은 규약을 쓴다.
 */
@Entity
@Table(name = "query_vector")
class QueryVectorJpaEntity(
    @Column(name = "model_ref", nullable = false, length = 120)
    val modelRef: String,

    @Column(name = "normalized", nullable = false, length = 255)
    val normalized: String,

    @Column(name = "query_text", nullable = false, length = 255)
    var queryText: String,

    @Column(name = "dim", nullable = false)
    var dim: Int,

    @Column(name = "vector", nullable = false, columnDefinition = "VARBINARY(16384)")
    var vector: ByteArray,

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 16)
    var source: QueryVector.Source,

    @Column(name = "hit_count", nullable = false)
    var hitCount: Long = 0,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    val id: Long? = null,
) {
    fun toDomain(): QueryVector = QueryVector(
        query = queryText,
        normalized = normalized,
        modelRef = modelRef,
        vector = decode(vector),
        source = source,
        updatedAt = updatedAt,
    )

    /** 같은 (스탬프, 정규화 질의)에 다시 들어온 값으로 덮는다 — 모델이 같으면 값도 같아야 정상이다. */
    fun update(v: QueryVector) {
        queryText = v.query
        dim = v.dim
        vector = encode(v.vector)
        source = v.source
        updatedAt = v.updatedAt
    }

    companion object {
        fun from(v: QueryVector) = QueryVectorJpaEntity(
            modelRef = v.modelRef,
            normalized = v.normalized,
            queryText = v.query,
            dim = v.dim,
            vector = encode(v.vector),
            source = v.source,
            updatedAt = v.updatedAt,
        )

        fun encode(v: List<Float>): ByteArray {
            val buf = ByteBuffer.allocate(v.size * Float.SIZE_BYTES).order(ByteOrder.LITTLE_ENDIAN)
            v.forEach(buf::putFloat)
            return buf.array()
        }

        fun decode(bytes: ByteArray): List<Float> {
            val buf = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
            return List(bytes.size / Float.SIZE_BYTES) { buf.float }
        }
    }
}
