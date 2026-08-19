package com.kgd.deal.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.deal.application.dto.DealCategoryResponse
import com.kgd.deal.application.dto.DealCategorySection
import com.kgd.deal.application.dto.DealOfferResponse
import com.kgd.deal.application.service.DealQueryService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 혜택 링크 공개 API (ADR-0069).
 *
 * 응답에 `targetUrl` 은 없다 — 클릭은 반드시 `/go/{slug}` 를 거쳐야 계측되고,
 * 링크 교체가 즉시 반영된다.
 */
@RestController
@RequestMapping("/api/v1/deal")
class DealController(
    private val dealQueryService: DealQueryService,
) {

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<DealCategoryResponse>> =
        ApiResponse.success(dealQueryService.categories())

    @GetMapping("/offers")
    fun offers(@RequestParam category: String): ApiResponse<List<DealOfferResponse>> =
        ApiResponse.success(dealQueryService.offers(category))

    /** 허브 한 화면분 — 카테고리 5종을 왕복 한 번으로 받는다 */
    @GetMapping("/sections")
    fun sections(): ApiResponse<List<DealCategorySection>> =
        ApiResponse.success(dealQueryService.sections())
}
