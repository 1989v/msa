package com.kgd.inventory.presentation.inventory.controller

import com.kgd.common.response.ApiResponse
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.GetInventoryUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.presentation.inventory.dto.ConfirmRequest
import com.kgd.inventory.presentation.inventory.dto.ReceiveRequest
import com.kgd.inventory.presentation.inventory.dto.ReleaseRequest
import com.kgd.inventory.presentation.inventory.dto.ReserveRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/inventories")
class InventoryController(
    private val reserveStockUseCase: ReserveStockUseCase,
    private val releaseStockUseCase: ReleaseStockUseCase,
    private val confirmStockUseCase: ConfirmStockUseCase,
    private val receiveStockUseCase: ReceiveStockUseCase,
    private val getInventoryUseCase: GetInventoryUseCase,
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/reserve")
    fun reserve(@RequestBody request: ReserveRequest): ApiResponse<ReserveStockUseCase.Result> {
        val result = reserveStockUseCase.execute(
            ReserveStockUseCase.Command(
                orderId = request.orderId,
                productId = request.productId,
                warehouseId = request.warehouseId,
                qty = request.qty,
            )
        )
        return ApiResponse.success(result)
    }

    @PostMapping("/release")
    fun release(@RequestBody request: ReleaseRequest): ApiResponse<ReleaseStockUseCase.Result> {
        val result = releaseStockUseCase.execute(
            ReleaseStockUseCase.Command(
                orderId = request.orderId,
                productId = request.productId,
            )
        )
        return ApiResponse.success(result)
    }

    @PostMapping("/confirm")
    fun confirm(@RequestBody request: ConfirmRequest): ApiResponse<ConfirmStockUseCase.Result> {
        val result = confirmStockUseCase.execute(
            ConfirmStockUseCase.Command(
                orderId = request.orderId,
                productId = request.productId,
            )
        )
        return ApiResponse.success(result)
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/receive")
    fun receive(@RequestBody request: ReceiveRequest): ApiResponse<ReceiveStockUseCase.Result> {
        val result = receiveStockUseCase.execute(
            ReceiveStockUseCase.Command(
                productId = request.productId,
                warehouseId = request.warehouseId,
                qty = request.qty,
            )
        )
        return ApiResponse.success(result)
    }

    @GetMapping("/{productId}")
    fun getByProductId(@PathVariable productId: Long): ApiResponse<List<GetInventoryUseCase.Result>> {
        val result = getInventoryUseCase.execute(GetInventoryUseCase.Query(productId))
        return ApiResponse.success(result)
    }
}
