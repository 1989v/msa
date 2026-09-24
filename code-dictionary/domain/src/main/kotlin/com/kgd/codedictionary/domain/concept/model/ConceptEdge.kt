package com.kgd.codedictionary.domain.concept.model

import com.kgd.codedictionary.domain.concept.model.ConceptKind.DOMAIN
import com.kgd.codedictionary.domain.concept.model.ConceptKind.MECHANISM
import com.kgd.codedictionary.domain.concept.model.ConceptKind.METRIC
import com.kgd.codedictionary.domain.concept.model.ConceptKind.PROBLEM
import com.kgd.codedictionary.domain.concept.model.ConceptKind.STAGE
import com.kgd.codedictionary.domain.concept.model.ConceptKind.TECHNOLOGY
import com.kgd.codedictionary.domain.concept.model.ConceptKind.TERM

/**
 * 개념 사이의 **방향 있는** 간선. 관계마다 허용 (from kind → to kind) 가 있고 그 밖은 온톨로지 검증이 거부한다.
 * 대칭 관계는 한 방향만 저장하고 역방향은 [inverseLabel] 로 읽는다.
 */
enum class ConceptEdgeKind(val inverseLabel: String?, val symmetric: Boolean = false) {
    /** 상위 → 하위. 층을 만드는 유일한 간선 — 뜻은 구성·배치로만 */
    CONTAINS("PART_OF"),

    /** 앞 단계 → 뒤 단계. CONTAINS 부모를 공유하는 형제 사이라 층 계산에 안 들어간다 */
    FLOWS_TO("FOLLOWS"),

    /** 쓰는 쪽 → 쓰이는 것 */
    USES("USED_BY"),

    /** 구체물 → 그것이 구현하는 개념 */
    IMPLEMENTS("IMPLEMENTED_BY"),

    /** 원인 → 값이 달라지는 지표. 방향(↑↓)과 적용 조건은 reason 에 */
    AFFECTS("AFFECTED_BY"),

    /** 원인 → 불러오는 문제 */
    CAUSES("CAUSED_BY"),

    /** 장치 → 막는 문제 */
    MITIGATES("MITIGATED_BY"),

    /** 대상 → 재는 지표 */
    MEASURED_BY("MEASURES"),

    /** 대신 쓸 수 있는 것. 대칭 */
    ALTERNATIVE_TO(null, symmetric = true),
    ;

    fun allows(from: ConceptKind, to: ConceptKind): Boolean = when (this) {
        CONTAINS -> to in (CONTAINS_RANGE[from] ?: emptySet())
        FLOWS_TO -> true
        USES -> from in setOf(STAGE, MECHANISM) && to in setOf(TERM, MECHANISM, TECHNOLOGY)
        IMPLEMENTS -> from == TECHNOLOGY && to in setOf(STAGE, MECHANISM)
        AFFECTS -> from in setOf(MECHANISM, TERM, TECHNOLOGY) && to == METRIC
        CAUSES -> from in setOf(MECHANISM, TERM, TECHNOLOGY, PROBLEM) && to == PROBLEM
        MITIGATES -> from == MECHANISM && to == PROBLEM
        MEASURED_BY -> from in setOf(STAGE, MECHANISM, PROBLEM) && to == METRIC
        ALTERNATIVE_TO -> from == to && from in setOf(MECHANISM, TECHNOLOGY)
    }

    private companion object {
        val CONTAINS_RANGE: Map<ConceptKind, Set<ConceptKind>> = mapOf(
            DOMAIN to setOf(DOMAIN, STAGE, TERM),
            STAGE to setOf(STAGE, MECHANISM, METRIC, PROBLEM, TECHNOLOGY),
            MECHANISM to setOf(MECHANISM, TECHNOLOGY),
            TERM to setOf(TERM),
        )
    }
}

data class ConceptEdge(
    val id: Long? = null,
    val fromConceptId: String,
    val toConceptId: String,
    val kind: ConceptEdgeKind,
    /** 같은 부모 아래 형제 순서 */
    val ordinal: Int = 0,
    /** 관계의 「왜」와 적용 조건(방식·측정 범위·방향) 한 줄 */
    val reason: String? = null,
    /** 이 간선이 기대는 근거 하나 — ADR 파일명·글 slug·기록 페이지·측정 한 줄 */
    val evidenceRef: String? = null,
) {
    init {
        require(fromConceptId.isNotBlank() && toConceptId.isNotBlank()) { "간선 양 끝 conceptId 는 비어 있을 수 없습니다" }
        require(fromConceptId != toConceptId) { "자기 자신으로 가는 간선은 만들 수 없습니다: $fromConceptId" }
    }
}
