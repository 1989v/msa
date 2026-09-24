package com.kgd.order.presentation.order.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.order.application.order.usecase.ConfirmPurchaseUseCase
import com.kgd.order.presentation.order.dto.PurchaseConfirmResponse
import com.kgd.order.presentation.support.ClaimErrorResponses
import com.kgd.order.presentation.support.OrderRequestIdentity
import com.kgd.order.presentation.support.OrderSheetErrorResponses
import org.springframework.web.bind.annotation.*

/**
 * 구매 확정 버튼 — `POST /api/v1/orders/{id}/purchase-confirm` (ROLE_USER, 본인 주문). 이행 중 주문의 취소되지 않은 라인 전부를
 * 확정한다. 이행 전·진행 중 클레임·확정할 라인 없음은 409. 배송 완료 후 N일 자동 확정은 스케줄러가 한다.
 */
@RestController
@RequestMapping("/api/v1/orders")
class PurchaseConfirmController(private val confirmPurchase: ConfirmPurchaseUseCase) {

    @PostMapping("/{id}/purchase-confirm")
    fun confirm(
        @PathVariable id: Long,
        @RequestHeader("X-User-Id", required = false) userId: String?,
    ): ApiResponse<PurchaseConfirmResponse> =
        ApiResponse.success(PurchaseConfirmResponse(id, confirmPurchase.confirm(OrderRequestIdentity.requireUser(userId), id)))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = ClaimErrorResponses.of(e)

    @ExceptionHandler(IllegalArgumentException::class)
    fun handle(e: IllegalArgumentException) = OrderSheetErrorResponses.badRequest(e.message)
}
