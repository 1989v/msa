package com.kgd.codedictionary.application.graph.dto

/**
 * 계층 뷰 응답 — 진입점에서 `CONTAINS` 로 닿는 개념만 싣는다. 간선은 양 끝이 이 안에 있는 것만이라
 * 다른 루트로 가는 간선은 빠진다 — 도메인 간 탐색은 개념 단위 relations 로 한 홉씩 한다.
 */
data class ConceptHierarchyDto(
    val roots: List<String>,
    val nodes: List<HierarchyNodeDto>,
    val edges: List<HierarchyEdgeDto>,
)

data class HierarchyNodeDto(
    val id: String,
    val name: String,
    val category: String,
    val level: String,
    /** 진입점이 0. 두 부모를 가지면 짧은 쪽 */
    val depth: Int,
    val description: String?,
    /** 역할 축(DOMAIN·STAGE·MECHANISM·TERM·TECHNOLOGY·PROBLEM·METRIC). 온톨로지에 아직 놓이지 않았으면 null */
    val kind: String? = null,
)

data class HierarchyEdgeDto(
    val from: String,
    val to: String,
    /** ConceptEdgeKind 이름 — CONTAINS · FLOWS_TO · USES · IMPLEMENTS · AFFECTS · CAUSES · MITIGATES · MEASURED_BY · ALTERNATIVE_TO */
    val kind: String,
    val ordinal: Int,
    /** 관계의 「왜」와 적용 조건 */
    val reason: String? = null,
    val evidenceRef: String? = null,
)
