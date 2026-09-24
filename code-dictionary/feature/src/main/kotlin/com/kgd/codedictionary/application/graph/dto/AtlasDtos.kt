package com.kgd.codedictionary.application.graph.dto

/**
 * 개념 아틀라스 — 온톨로지 도메인(1차 노드) 목록과 도메인 사이 간선 수. `/tech` 첫 화면이 이것 하나로 그린다.
 * 순서는 manifest 가 정한 학습 순서다.
 */
data class ConceptAtlasDto(
    val domains: List<AtlasDomainDto>,
    val links: List<AtlasLinkDto>,
)

data class AtlasDomainDto(
    val domain: String,
    val rootId: String,
    val name: String,
    val description: String?,
    val conceptCount: Int,
    /** kind 이름 → 개수 */
    val kindCounts: Map<String, Int>,
    val codeRefCount: Int,
    /** 이 도메인이 관리하는 개념 id — 화면이 글 수(블로그 API)를 도메인별로 모을 때 쓴다 */
    val conceptIds: List<String>,
)

/** 도메인 사이를 가로지르는 간선 수 — 방향 없이 센다(`from` < `to`) */
data class AtlasLinkDto(val from: String, val to: String, val count: Int)

/** 저장소가 돌려주는 관리 개념 한 줄 */
data class AtlasConceptRow(
    val conceptId: String,
    val domain: String,
    val kind: String?,
    val name: String,
    val description: String?,
    val codeRefCount: Int,
)

/** 저장소가 돌려주는 간선 한 줄 — 양 끝의 관리 도메인 */
data class AtlasEdgeRow(val fromDomain: String, val toDomain: String, val kind: String)
