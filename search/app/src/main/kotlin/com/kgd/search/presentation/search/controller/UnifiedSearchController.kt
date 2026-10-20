package com.kgd.search.presentation.search.controller

import com.kgd.common.response.ApiResponse
import com.kgd.search.application.unified.usecase.SuggestUnifiedUseCase
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import com.kgd.search.application.unified.usecase.SearchUnifiedUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 통합 검색 (ADR-0090 D6) — 타입별 묶음으로 답한다. `type` 을 주면 그 타입만. */
@RestController
@RequestMapping("/api/search/unified")
class UnifiedSearchController(
    private val searchUnified: SearchUnifiedUseCase,
    private val suggestUnified: SuggestUnifiedUseCase,
) {
    @GetMapping
    fun search(
        @RequestParam q: String,
        @RequestParam(required = false) type: String?,
        @RequestParam(required = false) lang: String?,
        @RequestParam(defaultValue = "5") size: Int,
        @RequestParam(defaultValue = "0") page: Int,
    ): ApiResponse<SearchUnifiedUseCase.Result> =
        ApiResponse.success(searchUnified.execute(SearchUnifiedUseCase.Query(q = q, type = type, lang = lang, size = size, page = page)))
    @GetMapping("/suggest")
    fun suggest(@RequestParam q: String, @RequestParam(required = false) type: String?, @RequestParam(defaultValue = "8") size: Int): ApiResponse<SuggestUnifiedUseCase.Result> {
        val result = try { suggestUnified.execute(q, type, size) }
        catch (e: IllegalArgumentException) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, e.message) }
        catch (e: Exception) { throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Search unavailable", e) }
        return ApiResponse.success(result)
    }

}
