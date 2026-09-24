package com.kgd.order.presentation.cart.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.order.application.cart.usecase.ManageCartUseCase
import com.kgd.order.presentation.cart.dto.CartResponse
import com.kgd.order.presentation.cart.dto.PutCartItemRequest
import com.kgd.order.presentation.support.OrderRequestIdentity
import com.kgd.order.presentation.support.OrderSheetErrorResponses
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** 장바구니 — ROLE_USER, 본인 것만(`X-User-Id`). 경로에 회원 id 가 없어 남의 장바구니를 가리킬 방법이 없다 */
@RestController
@RequestMapping("/api/v1/cart")
class CartController(
    private val manageCartUseCase: ManageCartUseCase,
) {
    @GetMapping
    fun get(@RequestHeader(value = "X-User-Id", required = false) userId: String?): ApiResponse<CartResponse> =
        ApiResponse.success(CartResponse.from(manageCartUseCase.get(OrderRequestIdentity.requireUser(userId))))

    @PutMapping("/items/{productId}")
    fun put(
        @PathVariable productId: Long,
        @Valid @RequestBody request: PutCartItemRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<CartResponse> = ApiResponse.success(
        CartResponse.from(manageCartUseCase.put(OrderRequestIdentity.requireUser(userId), productId, request.quantity)),
    )

    @DeleteMapping("/items/{productId}")
    fun remove(
        @PathVariable productId: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<CartResponse> =
        ApiResponse.success(CartResponse.from(manageCartUseCase.remove(OrderRequestIdentity.requireUser(userId), productId)))

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping
    fun clear(@RequestHeader(value = "X-User-Id", required = false) userId: String?) =
        manageCartUseCase.clear(OrderRequestIdentity.requireUser(userId))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = OrderSheetErrorResponses.of(e)

    @ExceptionHandler(IllegalArgumentException::class)
    fun handle(e: IllegalArgumentException) = OrderSheetErrorResponses.badRequest(e.message)
}
