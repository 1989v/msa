package com.kgd.promotion.presentation.coupon.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.promotion.application.coupon.usecase.CouponDefinitionPageView
import com.kgd.promotion.application.coupon.usecase.CouponDefinitionView
import com.kgd.promotion.application.coupon.usecase.ManageCouponDefinitionUseCase
import com.kgd.promotion.presentation.coupon.dto.CreateCouponDefinitionRequest
import com.kgd.promotion.presentation.support.PromotionErrorResponses
import com.kgd.promotion.presentation.support.PromotionRequestIdentity
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** 쿠폰 정의 (ROLE_ADMIN) — 만들기·목록. 만든 사람이 정의에 남는다 */
@RestController
@RequestMapping("/api/v1/admin/promotions/coupons")
class CouponAdminController(
    private val manageCouponDefinitionUseCase: ManageCouponDefinitionUseCase,
) {
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(
        @Valid @RequestBody request: CreateCouponDefinitionRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<CouponDefinitionView> {
        val actor = PromotionRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(manageCouponDefinitionUseCase.create(request.toCommand(actor)))
    }

    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) size: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<CouponDefinitionPageView> {
        PromotionRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(manageCouponDefinitionUseCase.list(page, size))
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> = PromotionErrorResponses.of(e)

    /** 정의 조건 검증(도메인 require) 실패는 입력 오류다 */
    @ExceptionHandler(IllegalArgumentException::class)
    fun invalid(e: IllegalArgumentException): ResponseEntity<ApiResponse<Nothing>> = PromotionErrorResponses.badRequest()
}
