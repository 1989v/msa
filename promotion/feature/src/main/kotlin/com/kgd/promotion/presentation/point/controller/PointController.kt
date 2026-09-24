package com.kgd.promotion.presentation.point.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.promotion.application.point.usecase.GetMyPointsUseCase
import com.kgd.promotion.application.point.usecase.GrantPointsUseCase
import com.kgd.promotion.application.point.usecase.MyPointsView
import com.kgd.promotion.presentation.point.dto.GrantPointsRequest
import com.kgd.promotion.presentation.support.PromotionErrorResponses
import com.kgd.promotion.presentation.support.PromotionRequestIdentity
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** 내 포인트(`/api/v1/points/me`, ROLE_USER) · 어드민 지급(`/api/v1/admin/promotions/points/grants`, ROLE_ADMIN) */
@RestController
class PointController(
    private val getMyPointsUseCase: GetMyPointsUseCase,
    private val grantPointsUseCase: GrantPointsUseCase,
) {
    @GetMapping("/api/v1/points/me")
    fun myPoints(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<MyPointsView> = ApiResponse.success(getMyPointsUseCase.get(PromotionRequestIdentity.requireUser(userId)))

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/v1/admin/promotions/points/grants")
    fun grant(
        @Valid @RequestBody request: GrantPointsRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<MyPointsView> {
        val actor = PromotionRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(
            grantPointsUseCase.grant(GrantPointsUseCase.Grant(request.memberId.trim(), request.amount, actor, request.reason)),
        )
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> = PromotionErrorResponses.of(e)
}
