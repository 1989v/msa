package com.kgd.order.presentation.claim.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.order.application.claim.usecase.GetClaimsUseCase
import com.kgd.order.application.claim.usecase.PreviewClaimUseCase
import com.kgd.order.application.claim.usecase.RequestClaimUseCase
import com.kgd.order.presentation.claim.dto.ClaimPreviewResponse
import com.kgd.order.presentation.claim.dto.ClaimRequest
import com.kgd.order.presentation.claim.dto.ClaimResponse
import com.kgd.order.presentation.support.ClaimErrorResponses
import com.kgd.order.presentation.support.OrderRequestIdentity
import com.kgd.order.presentation.support.OrderSheetErrorResponses
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

/**
 * 구매자 클레임 — ROLE_USER, 본인 주문만(헤더 없으면 401, 남의 주문은 404).
 *
 * - `GET /api/v1/claims/preview?orderId=&lines=1,2` — 환불 미리보기(서버 계산). lines 가 없으면 전체 취소.
 * - `POST /api/v1/claims {orderId, lineNos?}` → 202, 판매자마다 한 건. 처리는 비동기(이행 취소 → 재입고 → 원복 → 환불).
 * - `GET /api/v1/claims?orderId=` — 주문의 클레임.
 * 취소할 수 없는 상태·라인·이미 요청 중인 라인은 409.
 */
@RestController
@RequestMapping("/api/v1/claims")
class ClaimController(
    private val requestClaim: RequestClaimUseCase,
    private val getClaims: GetClaimsUseCase,
    private val previewClaim: PreviewClaimUseCase,
) {
    @GetMapping("/preview")
    fun preview(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestParam orderId: Long,
        @RequestParam(required = false) lines: List<Int>?,
    ): ApiResponse<ClaimPreviewResponse> =
        ApiResponse.success(ClaimPreviewResponse.from(previewClaim.preview(OrderRequestIdentity.requireUser(userId), orderId, lines)))

    @ResponseStatus(HttpStatus.ACCEPTED)
    @PostMapping
    fun request(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestBody request: ClaimRequest,
    ): ApiResponse<List<ClaimResponse>> =
        ApiResponse.success(
            requestClaim.request(OrderRequestIdentity.requireUser(userId), request.orderId, request.lineNos).map(ClaimResponse::from),
        )

    @GetMapping
    fun forOrder(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestParam orderId: Long,
    ): ApiResponse<List<ClaimResponse>> =
        ApiResponse.success(getClaims.forOrder(OrderRequestIdentity.requireUser(userId), orderId).map(ClaimResponse::from))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = ClaimErrorResponses.of(e)

    @ExceptionHandler(IllegalArgumentException::class)
    fun handle(e: IllegalArgumentException) = OrderSheetErrorResponses.badRequest(e.message)
}
