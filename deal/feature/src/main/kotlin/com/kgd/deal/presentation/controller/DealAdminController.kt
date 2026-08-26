package com.kgd.deal.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.deal.application.category.dto.DealCategoryAdminResponse
import com.kgd.deal.application.category.dto.DealCategoryRequest
import com.kgd.deal.application.category.usecase.CreateDealCategoryUseCase
import com.kgd.deal.application.category.usecase.DeleteDealCategoryUseCase
import com.kgd.deal.application.category.usecase.ListDealCategoriesAdminUseCase
import com.kgd.deal.application.category.usecase.UpdateDealCategoryUseCase
import com.kgd.deal.application.offer.dto.DealAttentionResponse
import com.kgd.deal.application.offer.dto.DealClickDaily
import com.kgd.deal.application.offer.dto.DealOfferAdminResponse
import com.kgd.deal.application.offer.dto.DealOfferRequest
import com.kgd.deal.application.offer.usecase.CreateDealOfferUseCase
import com.kgd.deal.application.offer.usecase.DeleteDealOfferUseCase
import com.kgd.deal.application.offer.usecase.GetDealAttentionUseCase
import com.kgd.deal.application.offer.usecase.GetDealOfferClicksUseCase
import com.kgd.deal.application.offer.usecase.ListDealOffersAdminUseCase
import com.kgd.deal.application.offer.usecase.UpdateDealOfferUseCase
import com.kgd.deal.domain.model.LinkStatus
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

/**
 * 혜택 링크 관리 API (ADR-0069).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다 (display 어드민과 동일).
 */
@RestController
@RequestMapping("/api/v1/admin/deal")
class DealAdminController(
    private val listCategories: ListDealCategoriesAdminUseCase,
    private val createCategory: CreateDealCategoryUseCase,
    private val updateCategory: UpdateDealCategoryUseCase,
    private val deleteCategory: DeleteDealCategoryUseCase,
    private val listOffers: ListDealOffersAdminUseCase,
    private val createOffer: CreateDealOfferUseCase,
    private val updateOffer: UpdateDealOfferUseCase,
    private val deleteOffer: DeleteDealOfferUseCase,
    private val getAttention: GetDealAttentionUseCase,
    private val getOfferClicks: GetDealOfferClicksUseCase,
) {

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<DealCategoryAdminResponse>> = ApiResponse.success(listCategories.execute())

    @PostMapping("/categories")
    fun createCategory(@Valid @RequestBody request: DealCategoryRequest): ApiResponse<DealCategoryAdminResponse> =
        ApiResponse.success(createCategory.execute(request))

    @PutMapping("/categories/{id}")
    fun updateCategory(
        @PathVariable id: Long,
        @Valid @RequestBody request: DealCategoryRequest,
    ): ApiResponse<DealCategoryAdminResponse> =
        ApiResponse.success(updateCategory.execute(UpdateDealCategoryUseCase.Command(id, request)))

    @DeleteMapping("/categories/{id}")
    fun deleteCategory(@PathVariable id: Long): ApiResponse<Unit> {
        deleteCategory.execute(DeleteDealCategoryUseCase.Command(id))
        return ApiResponse.success(Unit)
    }

    @GetMapping("/offers")
    fun offers(
        @RequestParam(required = false) categoryId: Long?,
        @RequestParam(required = false) linkStatus: LinkStatus?,
    ): ApiResponse<List<DealOfferAdminResponse>> =
        ApiResponse.success(listOffers.execute(ListDealOffersAdminUseCase.Query(categoryId, linkStatus)))

    @PostMapping("/offers")
    fun createOffer(@Valid @RequestBody request: DealOfferRequest): ApiResponse<DealOfferAdminResponse> =
        ApiResponse.success(createOffer.execute(request))

    @PutMapping("/offers/{id}")
    fun updateOffer(
        @PathVariable id: Long,
        @Valid @RequestBody request: DealOfferRequest,
    ): ApiResponse<DealOfferAdminResponse> =
        ApiResponse.success(updateOffer.execute(UpdateDealOfferUseCase.Command(id, request)))

    @DeleteMapping("/offers/{id}")
    fun deleteOffer(@PathVariable id: Long): ApiResponse<Unit> {
        deleteOffer.execute(DeleteDealOfferUseCase.Command(id))
        return ApiResponse.success(Unit)
    }

    /** 만료 임박 · 오래 미수정 · 링크 깨짐 — 방치를 막는 유일한 장치라 한 응답으로 묶는다 */
    @GetMapping("/offers/attention")
    fun attention(): ApiResponse<DealAttentionResponse> = ApiResponse.success(getAttention.execute())

    @GetMapping("/offers/{id}/clicks")
    fun clicks(
        @PathVariable id: Long,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): ApiResponse<List<DealClickDaily>> =
        ApiResponse.success(getOfferClicks.execute(GetDealOfferClicksUseCase.Query(id, from, to)))
}
