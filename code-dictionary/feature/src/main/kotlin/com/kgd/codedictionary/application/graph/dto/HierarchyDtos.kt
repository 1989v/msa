package com.kgd.codedictionary.application.graph.dto

/** 계층 뷰 응답 — 진입점에서 `CONTAINS` 로 닿는 개념만 싣는다 */
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
)

data class HierarchyEdgeDto(
    val from: String,
    val to: String,
    /** CONTAINS · FLOWS_TO · SAME_AS */
    val kind: String,
    val ordinal: Int,
)
