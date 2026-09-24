package com.kgd.codedictionary.application.graph.dto

/** 개념 하나의 이웃 전부 — 루트·도메인과 무관하다. 도메인 간 탐색은 이것으로 한 홉씩 한다 */
data class ConceptRelationsDto(
    val concept: RelationConceptDto,
    /** 이 개념에서 나가는 간선 — label 은 관계 이름 */
    val outgoing: List<RelationEdgeDto>,
    /** 이 개념으로 들어오는 간선 — label 은 역방향 이름(PART_OF · USED_BY …). 대칭 관계는 이름 그대로 */
    val incoming: List<RelationEdgeDto>,
    val evidence: List<EvidenceDto>,
    val questions: List<String>,
)

data class RelationConceptDto(
    val id: String,
    val name: String,
    val kind: String?,
    val category: String,
    val level: String,
    val description: String?,
    val managedBy: String?,
)

data class RelationEdgeDto(
    /** ConceptEdgeKind 이름 */
    val relation: String,
    /** 읽는 방향의 이름 — 나가는 쪽은 관계 이름, 들어오는 쪽은 역방향 이름 */
    val label: String,
    val conceptId: String,
    val name: String,
    val conceptKind: String?,
    val reason: String?,
    val evidenceRef: String?,
)

data class EvidenceDto(val kind: String, val ref: String, val note: String?)
