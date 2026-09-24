package com.kgd.order.presentation.claim.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.order.application.claim.usecase.DecideClaimUseCase
import com.kgd.order.application.claim.usecase.GetClaimsUseCase
import com.kgd.order.presentation.claim.dto.ClaimRejectRequest
import com.kgd.order.presentation.claim.dto.ClaimResponse
import com.kgd.order.presentation.support.ClaimErrorResponses
import com.kgd.order.presentation.support.OrderRequestIdentity
import com.kgd.order.presentation.support.OrderSheetErrorResponses
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.*

/**
 * 판매자 포털 클레임 — 게이트웨이 ROLE_SELLER + 서비스가 매 요청 `X-User-Id` 의 ACTIVE 판매자 행을 본다(정지 즉시 403).
 * 자기 판매자 id 의 클레임만(남의 것은 404). 결정은 이미 출고된 취소 요청(SELLER_DECISION)만 — 그 밖은 409.
 */
@RestController
@RequestMapping("/api/v1/seller/claims")
class SellerClaimController(
    private val getClaims: GetClaimsUseCase,
    private val decide: DecideClaimUseCase,
) {
    @GetMapping
    fun list(@RequestHeader("X-User-Id", required = false) userId: String?): ApiResponse<List<ClaimResponse>> =
        ApiResponse.success(getClaims.forSeller(OrderRequestIdentity.requireUser(userId)).map(ClaimResponse::from))

    @PostMapping("/{claimId}/approve")
    fun approve(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @PathVariable claimId: Long,
    ): ApiResponse<ClaimResponse> = ApiResponse.success(ClaimResponse.from(decide.approve(OrderRequestIdentity.requireUser(userId), claimId)))

    @PostMapping("/{claimId}/reject")
    fun reject(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @PathVariable claimId: Long,
        @Valid @RequestBody request: ClaimRejectRequest,
    ): ApiResponse<ClaimResponse> =
        ApiResponse.success(ClaimResponse.from(decide.reject(OrderRequestIdentity.requireUser(userId), claimId, request.reason)))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = ClaimErrorResponses.of(e)

    @ExceptionHandler(IllegalArgumentException::class)
    fun handle(e: IllegalArgumentException) = OrderSheetErrorResponses.badRequest(e.message)
}
