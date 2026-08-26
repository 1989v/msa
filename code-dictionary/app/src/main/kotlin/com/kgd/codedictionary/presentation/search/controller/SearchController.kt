package com.kgd.codedictionary.presentation.search.controller

import com.kgd.codedictionary.application.search.dto.SearchCommand
import com.kgd.codedictionary.application.search.dto.SearchResultDto
import com.kgd.codedictionary.application.search.usecase.SearchConceptsUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/search")
class SearchController(
    private val searchConcepts: SearchConceptsUseCase
) {

    @GetMapping
    fun search(
        @RequestParam q: String,
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) level: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ApiResponse<SearchResultDto> {
        val result = searchConcepts.search(
            SearchCommand(
                query = q,
                category = category,
                level = level,
                page = page,
                size = size
            )
        )
        return ApiResponse.success(result)
    }
}
