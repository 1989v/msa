package com.kgd.codedictionary.presentation.search.controller

import com.kgd.codedictionary.application.search.dto.SearchCommand
import com.kgd.codedictionary.application.search.dto.SearchResultDto
import com.kgd.codedictionary.application.search.service.SearchService
import com.kgd.common.response.ApiResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/search")
class SearchController(
    private val searchService: SearchService
) {

    @GetMapping
    fun search(
        @RequestParam q: String,
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) level: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<SearchResultDto>> {
        val result = searchService.search(
            SearchCommand(
                query = q,
                category = category,
                level = level,
                page = page,
                size = size
            )
        )
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
