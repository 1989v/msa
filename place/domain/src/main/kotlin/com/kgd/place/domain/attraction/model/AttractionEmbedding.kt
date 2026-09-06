package com.kgd.place.domain.attraction.model

import java.security.MessageDigest
import java.time.LocalDateTime
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * 관광지 임베딩 벡터 (ADR-0090).
 *
 * 서버는 벡터를 **만들지 않고 검사만 한다** — 임베딩 텍스트를 조립하는 규칙은 `tools/embed` 한 곳에 있다.
 * 여기서 막는 것은 도구의 버그가 조용히 저장되는 것: 차원 불일치, 텍스트와 어긋난 해시, 정규화 안 된 벡터.
 */
class AttractionEmbedding private constructor(
    val id: Long? = null,
    val attractionId: Long,
    val modelRef: EmbeddingModelRef,
    val embeddingText: String,
    val textHash: String,
    val vector: FloatArray,
    val embeddedAt: LocalDateTime,
) {
    /** 텍스트가 그대로면 벡터를 다시 받지 않고 시각만 민다 (도구의 touch). */
    fun touched(at: LocalDateTime): AttractionEmbedding =
        AttractionEmbedding(id, attractionId, modelRef, embeddingText, textHash, vector, at)

    companion object {
        private const val NORM_TOLERANCE = 0.01

        @Suppress("LongParameterList")
        fun create(
            attractionId: Long,
            modelRef: EmbeddingModelRef,
            embeddingText: String,
            textHash: String,
            vector: FloatArray,
            embeddedAt: LocalDateTime = LocalDateTime.now(),
            id: Long? = null,
        ): AttractionEmbedding {
            require(embeddingText.isNotBlank()) { "임베딩 텍스트는 비어있을 수 없습니다" }
            require(vector.size == modelRef.dim) {
                "벡터 차원이 model_ref 와 다릅니다: ${vector.size} != ${modelRef.dim}"
            }
            require(textHash == EmbeddingText.hash(modelRef, embeddingText)) {
                "text_hash 가 임베딩 텍스트와 맞지 않습니다 — 도구가 다른 텍스트로 계산했을 수 있습니다"
            }
            val norm = l2Norm(vector)
            require(abs(norm - 1.0) < NORM_TOLERANCE) { "벡터가 L2 정규화돼 있지 않습니다: norm=$norm" }
            return AttractionEmbedding(id, attractionId, modelRef, embeddingText, textHash, vector, embeddedAt)
        }

        fun l2Norm(vector: FloatArray): Double {
            var sum = 0.0
            for (v in vector) sum += v.toDouble() * v.toDouble()
            return sqrt(sum)
        }
    }
}

/**
 * 해시 규약만 도메인이 갖는다. 임베딩 텍스트를 **만드는** 규칙은 서버에 없다 —
 * 두 구현이 생기면 갈라지고, 갈라지면 해시가 전부 어긋나 조용히 전량 재임베딩이 된다.
 */
object EmbeddingText {
    fun hash(modelRef: EmbeddingModelRef, text: String): String = hash(modelRef.value, text)

    fun hash(modelRef: String, text: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest("$modelRef\n$text".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
