package com.kgd.deal.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.deal.application.category.dto.DealCategoryResponse
import com.kgd.deal.application.category.usecase.GetDealCategoriesUseCase
import com.kgd.deal.application.offer.dto.DealCategorySection
import com.kgd.deal.application.offer.dto.DealOfferResponse
import com.kgd.deal.application.offer.usecase.GetDealOffersUseCase
import com.kgd.deal.application.offer.usecase.GetDealSectionsUseCase
import com.kgd.deal.application.offer.usecase.SearchDealOffersUseCase
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
    private val getCategories: GetDealCategoriesUseCase,
    private val getOffers: GetDealOffersUseCase,
    private val getSections: GetDealSectionsUseCase,
    private val searchOffers: SearchDealOffersUseCase,
) {

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<DealCategoryResponse>> = ApiResponse.success(getCategories.execute())

    @GetMapping("/offers")
    fun offers(@RequestParam category: String): ApiResponse<List<DealOfferResponse>> =
        ApiResponse.success(getOffers.execute(GetDealOffersUseCase.Query(category)))

    /** 허브 한 화면분 — 카테고리 5종을 왕복 한 번으로 받는다 */
    @GetMapping("/sections")
    fun sections(): ApiResponse<List<DealCategorySection>> = ApiResponse.success(getSections.execute())

    /**
     * 이름 · 제공처 · 혜택으로 찾기. 응답 모양은 [sections] 와 같다.
     *
     * 검색 결과에 별도 URL 을 주지 않는다 — 검색은 허브의 화면 상태이고,
     * 색인 대상 주소는 허브 하나다 (ADR-0069 개정).
     */
    @GetMapping("/search")
    fun search(@RequestParam q: String): ApiResponse<List<DealCategorySection>> =
        ApiResponse.success(searchOffers.execute(SearchDealOffersUseCase.Query(q)))
}
