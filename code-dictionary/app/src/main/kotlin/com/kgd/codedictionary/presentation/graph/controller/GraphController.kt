package com.kgd.codedictionary.presentation.graph.controller

import com.kgd.codedictionary.application.graph.dto.GraphDataDto
import com.kgd.codedictionary.application.graph.service.GraphService
import com.kgd.common.response.ApiResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/concepts")
class GraphController(
    private val graphService: GraphService
) {
    @GetMapping("/graph")
    fun getGraphData(): ResponseEntity<ApiResponse<GraphDataDto>> {
        val result = graphService.getGraphData()
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
