package com.kgd.search.presentation.search.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.search.application.marketstore.usecase.SearchMarketStoreUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class MarketStoreSearchController(private val useCase: SearchMarketStoreUseCase) {
    @GetMapping("/api/v1/search/market-stores")
    fun search(@RequestParam q: String,
        @RequestParam(required = false) contentId: String?,
        @RequestParam(defaultValue = "ko") lang: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(required = false) size: Int?,
    ): ApiResponse<SearchMarketStoreUseCase.Result> {
        val limit = size ?: if (contentId == null) 20 else 200
        if (q.isBlank() || q.length > 200 || (contentId != null && !contentId.matches(Regex("[0-9]{1,30}"))) ||
            lang !in setOf("ko", "en") || page < 0 || limit !in 1..200 || page.toLong() * limit + limit > 10000) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "Invalid market-store search parameters")
        }
        return ApiResponse.success(useCase.search(SearchMarketStoreUseCase.Query(q.trim(), contentId, lang, page, limit)))
    }
}
