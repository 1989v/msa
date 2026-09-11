package com.kgd.codedictionary.application.graph.dto

/**
 * 트리맵 stats endpoint 응답 DTO.
 * 카테고리별 concept 분포 + level / category 집계 totals 를 함께 전달한다.
 *
 * spec.md §5.1 / §4.2 참조.
 */
data class TreemapDataDto(
    val categories: List<TreemapCategoryDto>,
    val totals: TreemapTotalsDto
)

data class TreemapCategoryDto(
    val name: String,
    val totalConcepts: Int,
    val totalIndexCount: Int,
    val concepts: List<TreemapConceptDto>
)

data class TreemapConceptDto(
    val conceptId: String,
    val name: String,
    val level: String,
    val indexCount: Int
)

data class TreemapTotalsDto(
    val byLevel: Map<String, Int>,
    val byCategory: Map<String, Int>,
    val totalConcepts: Int,
    val totalIndexCount: Int
)

/**
 * stats endpoint 입력 필터.
 *
 * - [categories] null 또는 empty → 전체 카테고리.
 * - [includeZeroIndex] false 시 indexCount=0 concept 는 응답에서 제외하되,
 *   카테고리 전체가 0 이면 placeholder 1 개 보존 (spec.md Q4).
 *
 * `@Cacheable` key 로 사용되므로 immutable + equals/hashCode 안정성 필요 → data class.
 */
data class CategoryStatsFilter(
    val categories: Set<String>? = null,
    val includeZeroIndex: Boolean = false
)
