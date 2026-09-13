package com.kgd.codedictionary.domain.concept.model

/**
 * 개념 사이의 **방향 있는** 간선. `Concept.relatedConceptIds` 는 방향도 뜻도 없어
 * 「A 는 B 의 하위 단계」와 「A 는 B 와 관련」을 가르지 못한다 — 층은 이 간선으로만 만든다.
 */
enum class ConceptEdgeKind {
    /** 상위 → 하위. 층을 만드는 유일한 간선 */
    CONTAINS,

    /** 앞 단계 → 뒤 단계. 같은 층 안의 순서라 층 계산에 안 들어간다 */
    FLOWS_TO,

    /** 표기가 다를 뿐 같은 것 */
    SAME_AS,
}

data class ConceptEdge(
    val id: Long? = null,
    val fromConceptId: String,
    val toConceptId: String,
    val kind: ConceptEdgeKind,
    /** 같은 부모 아래 형제 순서 */
    val ordinal: Int = 0,
) {
    init {
        require(fromConceptId.isNotBlank() && toConceptId.isNotBlank()) { "간선 양 끝 conceptId 는 비어 있을 수 없습니다" }
        require(fromConceptId != toConceptId) { "자기 자신으로 가는 간선은 만들 수 없습니다: $fromConceptId" }
    }
}
