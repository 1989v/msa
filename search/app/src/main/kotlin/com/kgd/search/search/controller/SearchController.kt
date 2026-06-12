package com.kgd.search.presentation.search.controller

import com.kgd.common.response.ApiResponse
import com.kgd.search.application.product.usecase.SearchProductUseCase
import com.kgd.search.application.product.usecase.SuggestProductUseCase
import com.kgd.search.domain.bandit.model.BanditKey
import com.kgd.search.domain.bandit.model.ClickEvent
import com.kgd.search.domain.bandit.model.ImpressionEvent
import com.kgd.search.domain.bandit.port.BanditEventPort
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/search")
class SearchController(
    private val searchProductUseCase: SearchProductUseCase,
    private val suggestProductUseCase: SuggestProductUseCase,
    private val banditEventPort: BanditEventPort
) {

    @GetMapping("/products")
    fun searchProducts(
        @RequestParam keyword: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(required = false) userId: String?
    ): ApiResponse<SearchProductUseCase.Result> {
        val result = searchProductUseCase.execute(SearchProductUseCase.Query(keyword, page, size, userId))
        return ApiResponse.success(result)
    }

    /** 상품명 자동완성 — 검색창 입력 중 prefix 매칭 (ACTIVE 상품, 인기도 부스트). */
    @GetMapping("/products/suggest")
    fun suggestProducts(
        @RequestParam q: String,
        @RequestParam(defaultValue = "8") size: Int
    ): ApiResponse<List<SuggestProductUseCase.Suggestion>> {
        if (q.isBlank()) return ApiResponse.success(emptyList())
        return ApiResponse.success(suggestProductUseCase.execute(q, size.coerceIn(1, 20)))
    }

    /**
     * 클라이언트가 검색 결과를 화면에 노출했음을 보고. ADR-0043 의 Bandit state 누적 입력.
     */
    @PostMapping("/impressions")
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun reportImpressions(@RequestBody request: ImpressionsRequest): ApiResponse<Unit> {
        request.items.forEach { item ->
            banditEventPort.recordImpression(
                ImpressionEvent(
                    searchId = request.searchId,
                    key = BanditKey.category(item.categoryId, item.productId),
                    position = item.position,
                    userId = request.userId
                )
            )
        }
        return ApiResponse.success()
    }

    /**
     * 사용자가 검색 결과에서 특정 상품을 클릭했을 때 보고.
     */
    @PostMapping("/clicks")
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun reportClick(@RequestBody request: ClickRequest): ApiResponse<Unit> {
        banditEventPort.recordClick(
            ClickEvent(
                searchId = request.searchId,
                key = BanditKey.category(request.categoryId, request.productId),
                position = request.position,
                userId = request.userId
            )
        )
        return ApiResponse.success()
    }

    data class ImpressionsRequest(
        val searchId: String,
        val userId: String?,
        val items: List<ImpressionItem>
    )

    data class ImpressionItem(
        val categoryId: String?,
        val productId: String,
        val position: Int
    )

    data class ClickRequest(
        val searchId: String,
        val userId: String?,
        val categoryId: String?,
        val productId: String,
        val position: Int
    )
}
