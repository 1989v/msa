package com.kgd.fulfillment.presentation.fulfillment.controller

import com.kgd.common.response.ApiResponse
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.GetFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.TransitionFulfillmentUseCase
import com.kgd.fulfillment.application.ownership.usecase.AuthorizeFulfillmentAccessUseCase
import com.kgd.fulfillment.application.ownership.usecase.FulfillmentRequester
import com.kgd.fulfillment.domain.fulfillment.exception.FulfillmentNotFoundException
import com.kgd.fulfillment.presentation.fulfillment.dto.CreateFulfillmentRequest
import com.kgd.fulfillment.presentation.fulfillment.dto.TransitionRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

/**
 * 이행 REST — 게이트웨이(ROLE_SELLER|ROLE_ADMIN)를 지난 요청을 [AuthorizeFulfillmentAccessUseCase] 가 다시 판정한다.
 * 신원 헤더가 없으면 401. 생성은 어드민만, 전이·취소는 라인 전부가 자기 상품인 판매자, 조회는 라인 하나라도.
 */
@RestController
@RequestMapping("/api/fulfillments")
class FulfillmentController(
    private val createFulfillmentUseCase: CreateFulfillmentUseCase,
    private val transitionFulfillmentUseCase: TransitionFulfillmentUseCase,
    private val getFulfillmentUseCase: GetFulfillmentUseCase,
    private val accessAuthorizer: AuthorizeFulfillmentAccessUseCase,
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(
        @RequestBody request: CreateFulfillmentRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<CreateFulfillmentUseCase.Result> {
        accessAuthorizer.requireAdmin(FulfillmentRequester.of(userId, roles))
        val result = createFulfillmentUseCase.execute(
            CreateFulfillmentUseCase.Command(
                orderId = request.orderId,
                warehouseId = request.warehouseId
            )
        )
        return ApiResponse.success(result)
    }

    @PatchMapping("/{id}/transition")
    fun transition(
        @PathVariable id: Long,
        @RequestBody request: TransitionRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<TransitionFulfillmentUseCase.Result> {
        accessAuthorizer.requireWrite(FulfillmentRequester.of(userId, roles), id)
        val result = transitionFulfillmentUseCase.execute(
            TransitionFulfillmentUseCase.Command(
                fulfillmentId = id,
                targetStatus = request.targetStatus
            )
        )
        return ApiResponse.success(result)
    }

    @PatchMapping("/{id}/cancel")
    fun cancel(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<TransitionFulfillmentUseCase.Result> {
        accessAuthorizer.requireWrite(FulfillmentRequester.of(userId, roles), id)
        val result = transitionFulfillmentUseCase.execute(
            TransitionFulfillmentUseCase.Command(
                fulfillmentId = id,
                targetStatus = "CANCELLED"
            )
        )
        return ApiResponse.success(result)
    }

    @GetMapping("/{id}")
    fun getById(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<GetFulfillmentUseCase.Result> {
        accessAuthorizer.requireRead(FulfillmentRequester.of(userId, roles), id)
        val result = getFulfillmentUseCase.findById(id)
        return ApiResponse.success(result)
    }

    /** 주문의 첫 이행 — 판매자는 읽을 수 있는 것 중 첫 번째 */
    @GetMapping("/orders/{orderId}")
    fun getByOrderId(
        @PathVariable orderId: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<GetFulfillmentUseCase.Result> {
        val readable = accessAuthorizer.readableIdsOfOrder(FulfillmentRequester.of(userId, roles), orderId)
            ?: return ApiResponse.success(getFulfillmentUseCase.findByOrderId(orderId))
        val result = getFulfillmentUseCase.findAllByOrderId(orderId).firstOrNull { it.fulfillmentId in readable }
            ?: throw FulfillmentNotFoundException(orderId)
        return ApiResponse.success(result)
    }

    @GetMapping("/orders/{orderId}/all")
    fun getAllByOrderId(
        @PathVariable orderId: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<GetFulfillmentUseCase.Result>> {
        val readable = accessAuthorizer.readableIdsOfOrder(FulfillmentRequester.of(userId, roles), orderId)
        val result = getFulfillmentUseCase.findAllByOrderId(orderId)
            .filter { readable == null || it.fulfillmentId in readable }
        return ApiResponse.success(result)
    }
}
