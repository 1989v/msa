package com.kgd.deal.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.deal.application.dto.DealAttentionResponse
import com.kgd.deal.application.dto.DealCategoryAdminResponse
import com.kgd.deal.application.dto.DealCategoryRequest
import com.kgd.deal.application.dto.DealClickDaily
import com.kgd.deal.application.dto.DealOfferAdminResponse
import com.kgd.deal.application.dto.DealOfferRequest
import com.kgd.deal.application.service.DealAdminService
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
    private val adminService: DealAdminService,
) {

    @GetMapping("/categories")
    fun categories(): ApiResponse<List<DealCategoryAdminResponse>> =
        ApiResponse.success(adminService.categories())

    @PostMapping("/categories")
    fun createCategory(@Valid @RequestBody request: DealCategoryRequest): ApiResponse<DealCategoryAdminResponse> =
        ApiResponse.success(adminService.createCategory(request))

    @PutMapping("/categories/{id}")
    fun updateCategory(
        @PathVariable id: Long,
        @Valid @RequestBody request: DealCategoryRequest,
    ): ApiResponse<DealCategoryAdminResponse> = ApiResponse.success(adminService.updateCategory(id, request))

    @DeleteMapping("/categories/{id}")
    fun deleteCategory(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteCategory(id)
        return ApiResponse.success(Unit)
    }

    @GetMapping("/offers")
    fun offers(
        @RequestParam(required = false) categoryId: Long?,
        @RequestParam(required = false) linkStatus: LinkStatus?,
    ): ApiResponse<List<DealOfferAdminResponse>> = ApiResponse.success(adminService.offers(categoryId, linkStatus))

    @PostMapping("/offers")
    fun createOffer(@Valid @RequestBody request: DealOfferRequest): ApiResponse<DealOfferAdminResponse> =
        ApiResponse.success(adminService.createOffer(request))

    @PutMapping("/offers/{id}")
    fun updateOffer(
        @PathVariable id: Long,
        @Valid @RequestBody request: DealOfferRequest,
    ): ApiResponse<DealOfferAdminResponse> = ApiResponse.success(adminService.updateOffer(id, request))

    @DeleteMapping("/offers/{id}")
    fun deleteOffer(@PathVariable id: Long): ApiResponse<Unit> {
        adminService.deleteOffer(id)
        return ApiResponse.success(Unit)
    }

    /** 만료 임박 · 오래 미수정 · 링크 깨짐 — 방치를 막는 유일한 장치라 한 응답으로 묶는다 */
    @GetMapping("/offers/attention")
    fun attention(): ApiResponse<DealAttentionResponse> = ApiResponse.success(adminService.attention())

    @GetMapping("/offers/{id}/clicks")
    fun clicks(
        @PathVariable id: Long,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): ApiResponse<List<DealClickDaily>> = ApiResponse.success(adminService.clicks(id, from, to))
}
