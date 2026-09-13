package com.kgd.codedictionary.presentation.graph.controller

import com.kgd.codedictionary.application.graph.dto.ConceptHierarchyDto
import com.kgd.codedictionary.application.graph.dto.GraphDataDto
import com.kgd.codedictionary.application.graph.usecase.ConceptGraphUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/concepts")
class GraphController(
    private val conceptGraph: ConceptGraphUseCase
) {
    @GetMapping("/graph")
    fun getGraphData(): ApiResponse<GraphDataDto> {
        val result = conceptGraph.getGraphData()
        return ApiResponse.success(result)
    }

    /** 계층 뷰 — `root` 를 주면 그 아래만, 없으면 진입점 전부 */
    @GetMapping("/graph/hierarchy")
    fun getHierarchy(@RequestParam(required = false) root: String?): ApiResponse<ConceptHierarchyDto> =
        ApiResponse.success(conceptGraph.getHierarchy(root?.takeIf { it.isNotBlank() }))
}
