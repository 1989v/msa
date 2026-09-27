package com.kgd.codedictionary.application.graph.usecase

import com.kgd.codedictionary.application.graph.dto.CategoryStatsFilter
import com.kgd.codedictionary.application.graph.dto.GraphDataDto
import com.kgd.codedictionary.application.graph.dto.TreemapDataDto

/** 개념 그래프·트리맵 집계 (시각화 화면 전용). */
interface ConceptGraphUseCase {
    fun getGraphData(): GraphDataDto
    fun getCategoryStats(filter: CategoryStatsFilter): TreemapDataDto
}
