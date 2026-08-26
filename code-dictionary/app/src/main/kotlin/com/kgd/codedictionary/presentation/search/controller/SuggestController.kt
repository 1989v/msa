package com.kgd.codedictionary.presentation.search.controller

import com.kgd.codedictionary.application.search.dto.SuggestCommand
import com.kgd.codedictionary.application.search.dto.SuggestItemDto
import com.kgd.codedictionary.application.search.usecase.SearchConceptsUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/search")
class SuggestController(
    private val searchConcepts: SearchConceptsUseCase
) {
    @GetMapping("/suggest")
    fun suggest(
        @RequestParam q: String,
        @RequestParam(defaultValue = "8") size: Int
    ): ApiResponse<List<SuggestItemDto>> {
        val result = searchConcepts.suggest(SuggestCommand(query = q, size = size))
        return ApiResponse.success(result)
    }
}
