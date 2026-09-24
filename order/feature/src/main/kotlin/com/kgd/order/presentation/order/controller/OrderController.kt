package com.kgd.order.presentation.order.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.response.ApiResponse
import com.kgd.order.application.order.usecase.CancelOrderUseCase
import com.kgd.order.application.order.usecase.GetMyOrdersUseCase
import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.presentation.order.dto.MyOrderResponse
import com.kgd.order.presentation.order.dto.OrderAcceptedResponse
import com.kgd.order.presentation.order.dto.OrderResponse
import com.kgd.order.presentation.order.dto.PlaceOrderRequest
import com.kgd.order.presentation.support.OrderRequestIdentity
import com.kgd.order.presentation.support.OrderSheetErrorResponses
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.net.URI

/**
 * 주문 — ROLE_USER, 본인 것만(신원 헤더가 없으면 401, 남의 주문은 404).
 *
 * - `POST /api/v1/orders {orderSheetId}` + `Idempotency-Key` → 202 + `Location`. 사가가 비동기로 진행한다.
 *   같은 키: 처리 중 409, 완료 뒤 처음 응답 그대로. 주문서 만료·재사용·소유자 불일치 422, 결제 대기 3건 초과 429.
 * - `GET /api/v1/orders/{id}` — 상태 · 사가 단계 · 실패 사유(FE 결제 대기 화면 폴링).
 * - `POST /api/v1/orders/{id}/cancel` — 피벗 전(CREATED)만 202, 결제 결과 확인 중·결제 뒤는 409.
 */
@RestController
@RequestMapping("/api/v1/orders")
class OrderController(
    private val placeOrderUseCase: PlaceOrderUseCase,
    private val getOrderUseCase: GetOrderUseCase,
    private val getMyOrdersUseCase: GetMyOrdersUseCase,
    private val cancelOrderUseCase: CancelOrderUseCase,
) {
    @PostMapping
    fun placeOrder(
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
        @Valid @RequestBody request: PlaceOrderRequest,
    ): ResponseEntity<ApiResponse<OrderAcceptedResponse>> {
        val user = OrderRequestIdentity.requireUser(userId)
        val key = idempotencyKey?.trim()?.takeIf { it.isNotEmpty() && it.length <= MAX_KEY_LENGTH }
            ?: throw BusinessException(ErrorCode.INVALID_INPUT, "Idempotency-Key 헤더(1~$MAX_KEY_LENGTH 자)가 필요합니다")
        val accepted = placeOrderUseCase.place(PlaceOrderUseCase.Command(user, key, request.orderSheetId))
        return ResponseEntity.accepted()
            .location(URI.create("/api/v1/orders/${accepted.orderId}"))
            .body(ApiResponse.success(OrderAcceptedResponse.from(accepted)))
    }

    /** 내 주문 목록 — 최신순 */
    @GetMapping("/my")
    fun getMyOrders(@RequestHeader("X-User-Id", required = false) userId: String?): ApiResponse<List<MyOrderResponse>> =
        ApiResponse.success(getMyOrdersUseCase.execute(OrderRequestIdentity.requireUser(userId)).map(MyOrderResponse::from))

    /** 주문 단건 — 본인 것만, ROLE_ADMIN 은 전체 */
    @GetMapping("/{id}")
    fun getOrder(
        @PathVariable id: Long,
        @RequestHeader("X-User-Id", required = false) userId: String?,
        @RequestHeader("X-User-Roles", required = false) roles: String?,
    ): ApiResponse<OrderResponse> {
        val isAdmin = roles.orEmpty().split(',').any { it.trim() == ROLE_ADMIN }
        return ApiResponse.success(OrderResponse.from(getOrderUseCase.execute(id, OrderRequestIdentity.requireUser(userId), isAdmin)))
    }

    @ResponseStatus(HttpStatus.ACCEPTED)
    @PostMapping("/{id}/cancel")
    fun cancel(
        @PathVariable id: Long,
        @RequestHeader("X-User-Id", required = false) userId: String?,
    ): ApiResponse<OrderResponse> =
        ApiResponse.success(OrderResponse.from(cancelOrderUseCase.cancel(OrderRequestIdentity.requireUser(userId), id)))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException) = OrderSheetErrorResponses.of(e)

    @ExceptionHandler(IllegalArgumentException::class)
    fun handle(e: IllegalArgumentException) = OrderSheetErrorResponses.badRequest(e.message)

    private companion object {
        const val ROLE_ADMIN = "ROLE_ADMIN"
        const val MAX_KEY_LENGTH = 100
    }
}
