package com.kgd.search.presentation.search.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 관광지 검색 (ADR-0065) — 키워드/카테고리/지역 필터 + geo 반경/거리순.
 * keyword 없이 필터만으로도 호출 가능 (지도 영역 브라우징).
 */
@RestController
@RequestMapping("/api/search/attractions")
class AttractionSearchController(
    private val searchAttractionUseCase: SearchAttractionUseCase,
) {

    @GetMapping
    fun search(
        @RequestParam(required = false) keyword: String?,
        @RequestParam(required = false) lang: String?,
        @RequestParam(required = false) areaCode: String?,
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) lat: Double?,
        @RequestParam(required = false) lng: Double?,
        @RequestParam(required = false) radiusKm: Double?,
        @RequestParam(defaultValue = "relevance") sort: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<SearchAttractionUseCase.Result> {
        val result = searchAttractionUseCase.execute(
            SearchAttractionUseCase.Query(
                keyword = keyword,
                lang = lang,
                areaCode = areaCode,
                category = category,
                lat = lat,
                lng = lng,
                radiusKm = radiusKm,
                sort = sort,
                page = page,
                size = size,
            )
        )
        return ApiResponse.success(result)
    }

    @GetMapping("/{id}")
    fun findById(@PathVariable id: String): ApiResponse<SearchAttractionUseCase.AttractionSearchResult> {
        val result = searchAttractionUseCase.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "관광지를 찾을 수 없습니다: id=$id")
        return ApiResponse.success(result)
    }
}
