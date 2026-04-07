package com.kgd.fulfillment.presentation.fulfillment.controller

import com.kgd.common.response.ApiResponse
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.GetFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.TransitionFulfillmentUseCase
import com.kgd.fulfillment.presentation.fulfillment.dto.CreateFulfillmentRequest
import com.kgd.fulfillment.presentation.fulfillment.dto.TransitionRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/fulfillments")
class FulfillmentController(
    private val createFulfillmentUseCase: CreateFulfillmentUseCase,
    private val transitionFulfillmentUseCase: TransitionFulfillmentUseCase,
    private val getFulfillmentUseCase: GetFulfillmentUseCase
) {

    @PostMapping
    fun create(@RequestBody request: CreateFulfillmentRequest): ResponseEntity<ApiResponse<CreateFulfillmentUseCase.Result>> {
        val result = createFulfillmentUseCase.execute(
            CreateFulfillmentUseCase.Command(
                orderId = request.orderId,
                warehouseId = request.warehouseId
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(result))
    }

    @PatchMapping("/{id}/transition")
    fun transition(
        @PathVariable id: Long,
        @RequestBody request: TransitionRequest
    ): ResponseEntity<ApiResponse<TransitionFulfillmentUseCase.Result>> {
        val result = transitionFulfillmentUseCase.execute(
            TransitionFulfillmentUseCase.Command(
                fulfillmentId = id,
                targetStatus = request.targetStatus
            )
        )
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @PatchMapping("/{id}/cancel")
    fun cancel(@PathVariable id: Long): ResponseEntity<ApiResponse<TransitionFulfillmentUseCase.Result>> {
        val result = transitionFulfillmentUseCase.execute(
            TransitionFulfillmentUseCase.Command(
                fulfillmentId = id,
                targetStatus = "CANCELLED"
            )
        )
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/{id}")
    fun getById(@PathVariable id: Long): ResponseEntity<ApiResponse<GetFulfillmentUseCase.Result>> {
        val result = getFulfillmentUseCase.findById(id)
        return ResponseEntity.ok(ApiResponse.success(result))
    }

    @GetMapping("/orders/{orderId}")
    fun getByOrderId(@PathVariable orderId: Long): ResponseEntity<ApiResponse<GetFulfillmentUseCase.Result>> {
        val result = getFulfillmentUseCase.findByOrderId(orderId)
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
