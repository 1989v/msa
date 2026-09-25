package com.kgd.inventory.presentation.inventory.controller

import com.kgd.common.response.ApiResponse
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.GetInventoryUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.application.ownership.usecase.AuthorizeInventoryAccessUseCase
import com.kgd.inventory.application.ownership.usecase.InventoryRequester
import com.kgd.inventory.presentation.inventory.dto.ConfirmRequest
import com.kgd.inventory.presentation.inventory.dto.ReceiveRequest
import com.kgd.inventory.presentation.inventory.dto.ReleaseRequest
import com.kgd.inventory.presentation.inventory.dto.ReserveRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 재고 REST — 게이트웨이(ROLE_SELLER|ROLE_ADMIN)를 지난 요청을 여기서 다시 판정한다.
 * 어드민은 전부, 판매자는 ACTIVE 판매자 행을 갖고 **자기 상품**의 재고만. 신원 헤더가 없으면 401.
 */
@RestController
@RequestMapping("/api/inventories")
class InventoryController(
    private val reserveStockUseCase: ReserveStockUseCase,
    private val releaseStockUseCase: ReleaseStockUseCase,
    private val confirmStockUseCase: ConfirmStockUseCase,
    private val receiveStockUseCase: ReceiveStockUseCase,
    private val getInventoryUseCase: GetInventoryUseCase,
    private val accessAuthorizer: AuthorizeInventoryAccessUseCase,
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/reserve")
    fun reserve(
        @RequestBody request: ReserveRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<ReserveStockUseCase.Result> {
        authorize(userId, roles, request.productId)
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
    fun release(
        @RequestBody request: ReleaseRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<ReleaseStockUseCase.Result> {
        authorize(userId, roles, request.productId)
        val result = releaseStockUseCase.execute(
            ReleaseStockUseCase.Command(
                orderId = request.orderId,
                productId = request.productId,
            )
        )
        return ApiResponse.success(result)
    }

    @PostMapping("/confirm")
    fun confirm(
        @RequestBody request: ConfirmRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<ConfirmStockUseCase.Result> {
        authorize(userId, roles, request.productId)
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
    fun receive(
        @RequestBody request: ReceiveRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<ReceiveStockUseCase.Result> {
        authorize(userId, roles, request.productId)
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
    fun getByProductId(
        @PathVariable productId: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<GetInventoryUseCase.Result>> {
        authorize(userId, roles, productId)
        val result = getInventoryUseCase.execute(GetInventoryUseCase.Query(productId))
        return ApiResponse.success(result)
    }

    private fun authorize(userId: String?, roles: String?, productId: Long) =
        accessAuthorizer.requireProductAccess(InventoryRequester.of(userId, roles), listOf(productId))
}
