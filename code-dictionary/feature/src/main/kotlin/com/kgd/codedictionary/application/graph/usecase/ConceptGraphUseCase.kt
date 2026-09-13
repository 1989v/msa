package com.kgd.codedictionary.application.graph.usecase

import com.kgd.codedictionary.application.graph.dto.CategoryStatsFilter
import com.kgd.codedictionary.application.graph.dto.ConceptHierarchyDto
import com.kgd.codedictionary.application.graph.dto.GraphDataDto
import com.kgd.codedictionary.application.graph.dto.TreemapDataDto

/** 개념 그래프·트리맵 집계 (시각화 화면 전용). */
interface ConceptGraphUseCase {
    fun getGraphData(): GraphDataDto
    fun getCategoryStats(filter: CategoryStatsFilter): TreemapDataDto

    /** `CONTAINS` 간선으로 층을 센 계층. [root] 가 null 이면 부모 없는 개념 전부가 진입점이다 */
    fun getHierarchy(root: String?): ConceptHierarchyDto
}
