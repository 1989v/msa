package com.kgd.order.presentation.order.controller

import com.kgd.common.response.ApiResponse
import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.presentation.order.dto.OrderResponse
import com.kgd.order.presentation.order.dto.PlaceOrderRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/orders")
class OrderController(
    private val placeOrderUseCase: PlaceOrderUseCase,
    private val getOrderUseCase: GetOrderUseCase
) {
    @PostMapping
    suspend fun placeOrder(
        @RequestHeader("X-User-Id") userId: String,
        @Valid @RequestBody request: PlaceOrderRequest
    ): ResponseEntity<ApiResponse<OrderResponse>> {
        val result = placeOrderUseCase.execute(request.toCommand(userId))
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(OrderResponse.from(result)))
    }

    @GetMapping("/{id}")
    fun getOrder(@PathVariable id: Long): ResponseEntity<ApiResponse<OrderResponse>> {
        val result = getOrderUseCase.execute(id)
        return ResponseEntity.ok(ApiResponse.success(OrderResponse.from(result)))
    }
}
