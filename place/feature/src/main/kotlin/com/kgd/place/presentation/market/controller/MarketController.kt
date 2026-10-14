package com.kgd.place.presentation.market.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.place.application.market.usecase.QueryMarketUseCase
import com.kgd.place.presentation.market.dto.MarketResponse
import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
class MarketController(private val query: QueryMarketUseCase) {
    @GetMapping("/api/v1/place/markets/{contentId}")
    fun find(
        @PathVariable contentId: String,
        @RequestParam(defaultValue = "ko") lang: String,
        @RequestParam(defaultValue = "false") includeOutside: Boolean,
    ): ResponseEntity<ApiResponse<MarketResponse?>> {
        if (lang != "ko" && lang != "en") throw BusinessException(ErrorCode.INVALID_INPUT, "lang must be ko or en")
        // The content ID is shared across languages. Store names/items stay in the original language.
        val result = query.find(contentId, includeOutside)
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic()
                .sMaxAge(Duration.ofMinutes(10)).staleWhileRevalidate(Duration.ofMinutes(5)))
            .body(ApiResponse.success(result?.let(MarketResponse::from)))
    }
}
