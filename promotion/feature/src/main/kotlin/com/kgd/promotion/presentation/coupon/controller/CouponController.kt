package com.kgd.promotion.presentation.coupon.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase
import com.kgd.promotion.application.coupon.usecase.GetMyCouponsUseCase
import com.kgd.promotion.application.coupon.usecase.MyCouponView
import com.kgd.promotion.presentation.support.PromotionErrorResponses
import com.kgd.promotion.presentation.support.PromotionRequestIdentity
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** 내 쿠폰(`/api/v1/coupons/me`) · 쿠폰 받기(`/api/v1/coupons/{definitionId}/claim`) — ROLE_USER, 본인 것만 */
@RestController
class CouponController(
    private val getMyCouponsUseCase: GetMyCouponsUseCase,
    private val claimCouponUseCase: ClaimCouponUseCase,
) {
    @GetMapping("/api/v1/coupons/me")
    fun myCoupons(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<List<MyCouponView>> = ApiResponse.success(getMyCouponsUseCase.list(PromotionRequestIdentity.requireUser(userId)))

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/v1/coupons/{definitionId}/claim")
    fun claim(
        @PathVariable definitionId: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<MyCouponView> =
        ApiResponse.success(claimCouponUseCase.claim(PromotionRequestIdentity.requireUser(userId), definitionId))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> = PromotionErrorResponses.of(e)
}
