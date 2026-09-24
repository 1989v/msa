package com.kgd.codedictionary.application.ontology.dto

import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology

/** 파일 묶음 하나 — manifest 와 도메인 파일 전부, 그리고 그 바이트로 낸 해시 */
data class LoadedOntology(val ontology: ConceptOntology, val contentHash: String)

/** `ontology_state` 단일 행 — 최신 적용 상태이지 이력이 아니다 */
data class OntologyState(
    val revision: Int,
    val contentHash: String?,
    val derivedHash: String?,
)

enum class ApplyOutcome {
    /** 새 revision 을 적용했다 */
    APPLIED,

    /** 같은 revision · 같은 해시 — 이미 적용됨 */
    SKIPPED_SAME,

    /** 파일 revision 이 DB 보다 낮다 — 옛 이미지. 데이터를 되돌리지 않는다 */
    SKIPPED_OLDER,
}

data class ApplyReport(
    val outcome: ApplyOutcome,
    val fileRevision: Int,
    val dbRevision: Int,
    val concepts: Int = 0,
    val edges: Int = 0,
    val released: Int = 0,
)
