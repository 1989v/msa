package com.kgd.order.presentation.order.controller

import com.kgd.common.response.ApiResponse
import com.kgd.order.application.order.usecase.GetMyOrdersUseCase
import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.presentation.order.dto.MyOrderResponse
import com.kgd.order.presentation.order.dto.OrderResponse
import com.kgd.order.presentation.order.dto.PlaceOrderRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/orders")
class OrderController(
    private val placeOrderUseCase: PlaceOrderUseCase,
    private val getOrderUseCase: GetOrderUseCase,
    private val getMyOrdersUseCase: GetMyOrdersUseCase,
) {
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    suspend fun placeOrder(
        @RequestHeader("X-User-Id") userId: String,
        @Valid @RequestBody request: PlaceOrderRequest
    ): ApiResponse<OrderResponse> {
        val result = placeOrderUseCase.execute(request.toCommand(userId))
        return ApiResponse.success(OrderResponse.from(result))
    }

    /** 내 주문 목록 — gateway 가 주입한 X-User-Id 기준, 최신순. */
    @GetMapping("/my")
    fun getMyOrders(@RequestHeader("X-User-Id") userId: String): ApiResponse<List<MyOrderResponse>> {
        val results = getMyOrdersUseCase.execute(userId)
        return ApiResponse.success(results.map { MyOrderResponse.from(it) })
    }

    /**
     * 주문 단건 조회 — 본인 주문만 허용. 타인 주문은 존재 여부를 숨기기 위해
     * 403 이 아닌 NOT_FOUND 로 응답한다. ROLE_ADMIN 은 전체 조회 가능.
     */
    @GetMapping("/{id}")
    fun getOrder(
        @PathVariable id: Long,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OrderResponse> {
        val result = getOrderUseCase.execute(id)
        val isAdmin = roles?.split(",")?.contains("ROLE_ADMIN") == true
        if (!isAdmin && userId != null && result.userId != userId) {
            throw OrderNotFoundException(id)
        }
        return ApiResponse.success(OrderResponse.from(result))
    }
}
