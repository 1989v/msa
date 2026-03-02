package com.kgd.search.presentation.search.controller

import com.kgd.common.response.ApiResponse
import com.kgd.search.application.product.usecase.SearchProductUseCase
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/search")
class SearchController(private val searchProductUseCase: SearchProductUseCase) {

    @GetMapping("/products")
    fun searchProducts(
        @RequestParam keyword: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<SearchProductUseCase.Result>> {
        val result = searchProductUseCase.execute(SearchProductUseCase.Query(keyword, page, size))
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
