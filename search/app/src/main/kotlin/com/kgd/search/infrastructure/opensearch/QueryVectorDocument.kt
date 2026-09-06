package com.kgd.search.infrastructure.opensearch

import com.kgd.search.domain.embedding.VectorCodec
import com.kgd.search.domain.queryvector.model.QueryVector
import java.time.LocalDateTime

/**
 * 사전 문서. 매핑이 `dynamic: strict` 라 **필드 이름이 매핑과 정확히 같아야** 한다 —
 * 오타는 색인 실패로 드러난다(조용히 들어가지 않는다).
 */
data class QueryVectorDocument(
    val query: String,
    val normalized: String,
    val modelRef: String,
    val dim: Int,
    /** float32 little-endian 의 base64 — 실수 배열 JSON 이면 항목당 3배다. */
    val vector: String,
    val source: String,
    val updatedAt: LocalDateTime,
) {
    fun toDomain() = QueryVector(
        query = query,
        normalized = normalized,
        modelRef = modelRef,
        vector = VectorCodec.decode(vector),
        source = QueryVector.Source.valueOf(source),
        updatedAt = updatedAt,
    )

    companion object {
        fun from(vector: QueryVector) = QueryVectorDocument(
            query = vector.query,
            normalized = vector.normalized,
            modelRef = vector.modelRef,
            dim = vector.dim,
            vector = VectorCodec.encode(vector.vector),
            source = vector.source.name,
            updatedAt = vector.updatedAt,
        )
    }
}
