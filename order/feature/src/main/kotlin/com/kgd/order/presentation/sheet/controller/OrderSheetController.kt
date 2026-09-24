package com.kgd.order.presentation.sheet.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.order.application.sheet.usecase.CreateOrderSheetUseCase
import com.kgd.order.application.sheet.usecase.GetOrderSheetUseCase
import com.kgd.order.presentation.sheet.dto.CreateOrderSheetRequest
import com.kgd.order.presentation.sheet.dto.OrderSheetResponse
import com.kgd.order.presentation.support.OrderRequestIdentity
import com.kgd.order.presentation.support.OrderSheetErrorResponses
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 주문서 — ROLE_USER, 본인 것만. 판매 불가·쿠폰/포인트 불가는 422, 남의 주문서 조회는 없는 주문서와 같은 404.
 */
@RestController
@RequestMapping("/api/v1/order-sheets")
class OrderSheetController(
    private val createOrderSheetUseCase: CreateOrderSheetUseCase,
    private val getOrderSheetUseCase: GetOrderSheetUseCase,
) {
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(
        @Valid @RequestBody request: CreateOrderSheetRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<OrderSheetResponse> {
        val memberId = OrderRequestIdentity.requireUser(userId)
        return ApiResponse.success(OrderSheetResponse.from(createOrderSheetUseCase.execute(request.toCommand(memberId))))
    }

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<OrderSheetResponse> =
        ApiResponse.success(OrderSheetResponse.from(getOrderSheetUseCase.execute(OrderRequestIdentity.requireUser(userId), id)))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = OrderSheetErrorResponses.of(e)

    @ExceptionHandler(IllegalArgumentException::class)
    fun handle(e: IllegalArgumentException) = OrderSheetErrorResponses.badRequest(e.message)
}
