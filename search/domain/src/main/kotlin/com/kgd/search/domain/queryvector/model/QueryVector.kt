package com.kgd.search.domain.queryvector.model

import java.time.LocalDateTime

/**
 * 질의 사전 한 항목 (ADR-0090).
 *
 * **이 항목은 절대 검색 결과가 되지 않는다.** 답이 되는 것은 문서 벡터(`attractions`)뿐이고,
 * 사전은 질의를 벡터로 바꾸는 표일 뿐이라 별도 인덱스에 두고 `vector` 를 `index: false` 로 박는다.
 *
 * [vector] 를 `FloatArray` 가 아니라 `List<Float>` 로 두는 이유: 배열은 동등성이 참조 비교라
 * 캐시·테스트가 조용히 어긋난다. 항목 수가 만 단위라 성능 차이는 재지 않아도 될 만큼 작다.
 */
data class QueryVector(
    /** 사람이 친 원문 — 표시·재적재용. 정규화가 바뀌어도 이것이 있어 모델 없이 다시 만든다. */
    val query: String,
    val normalized: String,
    val modelRef: String,
    val vector: List<Float>,
    val source: Source,
    val updatedAt: LocalDateTime,
) {
    init {
        require(vector.isNotEmpty()) { "벡터는 비어있을 수 없습니다" }
        require(normalized.isNotBlank()) { "정규화된 질의는 비어있을 수 없습니다" }
        require(modelRef.isNotBlank()) { "modelRef 는 비어있을 수 없습니다" }
    }

    /** 스탬프가 키에 들어가 있어 전환 중 두 스탬프가 공존해도 서로를 덮지 않는다. */
    val id: String get() = idOf(modelRef, normalized)

    val dim: Int get() = vector.size

    /** 어디서 온 질의인가. 우선순위를 매기거나 한 층만 지울 때 쓴다. */
    enum class Source { INTENT, VOCAB, TITLE, LOG }

    companion object {
        fun idOf(modelRef: String, normalized: String): String = "$modelRef|$normalized"
    }
}
