package com.kgd.order.presentation.order.controller

import com.kgd.common.response.ApiResponse
import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.presentation.order.dto.OrderResponse
import com.kgd.order.presentation.order.dto.PlaceOrderRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/orders")
class OrderController(
    private val placeOrderUseCase: PlaceOrderUseCase,
    private val getOrderUseCase: GetOrderUseCase
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

    @GetMapping("/{id}")
    fun getOrder(@PathVariable id: Long): ApiResponse<OrderResponse> {
        val result = getOrderUseCase.execute(id)
        return ApiResponse.success(OrderResponse.from(result))
    }
}
