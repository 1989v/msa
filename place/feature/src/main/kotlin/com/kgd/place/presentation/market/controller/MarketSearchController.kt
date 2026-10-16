package com.kgd.place.presentation.market.controller

import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.SearchMarketsUseCase
import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
class MarketSearchController(private val search: SearchMarketsUseCase,
    private val dictionary: com.kgd.place.application.market.usecase.MarketDishUseCase) {
    @GetMapping("/api/v1/place/markets/dishes")
    fun dishes(): ResponseEntity<ApiResponse<List<com.kgd.place.application.market.usecase.MarketDishUseCase.Dish>>> = ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
        .body(ApiResponse.success(dictionary.dishes()))

    @GetMapping("/api/v1/place/markets/search")
    fun search(@RequestParam(defaultValue = "") q: String,
        @RequestParam(defaultValue = "ko") lang: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<SearchMarketsUseCase.Result> = ApiResponse.success(search.search(q, lang, page, size))

    @GetMapping("/api/v1/place/markets/content-ids")
    fun contentIds(): ResponseEntity<ApiResponse<List<String>>> = ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
        .body(ApiResponse.success(search.contentIds()))
}
