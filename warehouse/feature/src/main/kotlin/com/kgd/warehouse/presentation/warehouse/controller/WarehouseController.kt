package com.kgd.warehouse.presentation.warehouse.controller

import com.kgd.common.exception.ForbiddenException
import com.kgd.common.exception.UnauthorizedException
import com.kgd.common.response.ApiResponse
import com.kgd.warehouse.application.warehouse.usecase.CreateWarehouseUseCase
import com.kgd.warehouse.application.warehouse.usecase.GetWarehouseUseCase
import com.kgd.warehouse.presentation.warehouse.dto.CreateWarehouseRequest
import com.kgd.warehouse.presentation.warehouse.dto.WarehouseResponse
import jakarta.validation.Valid
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
 * 창고 마스터 — 어드민 전용. 게이트웨이(ROLE_ADMIN)와 여기서 두 번 판정한다.
 * 창고는 판매자별 소유가 없는 플랫폼 자원이라 판매자에게 열 이유가 없다. 신원 헤더가 없으면 401.
 */
@RestController
@RequestMapping("/api/warehouses")
class WarehouseController(
    private val createWarehouseUseCase: CreateWarehouseUseCase,
    private val getWarehouseUseCase: GetWarehouseUseCase,
) {

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun create(
        @Valid @RequestBody request: CreateWarehouseRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<WarehouseResponse> {
        requireAdmin(userId, roles)
        val result = createWarehouseUseCase.execute(
            CreateWarehouseUseCase.Command(
                name = request.name,
                address = request.address,
                latitude = request.latitude,
                longitude = request.longitude,
            )
        )
        val response = WarehouseResponse(
            id = result.id,
            name = result.name,
            address = result.address,
            latitude = request.latitude,
            longitude = request.longitude,
            active = result.active,
        )
        return ApiResponse.success(response)
    }

    @GetMapping
    fun findAll(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<List<WarehouseResponse>> {
        requireAdmin(userId, roles)
        val results = getWarehouseUseCase.findAll().map { it.toResponse() }
        return ApiResponse.success(results)
    }

    @GetMapping("/{id}")
    fun findById(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<WarehouseResponse> {
        requireAdmin(userId, roles)
        val result = getWarehouseUseCase.findById(id)
        return ApiResponse.success(result.toResponse())
    }

    @GetMapping("/default")
    fun findDefault(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<WarehouseResponse> {
        requireAdmin(userId, roles)
        val result = getWarehouseUseCase.findDefaultWarehouse()
        return ApiResponse.success(result.toResponse())
    }

    private fun requireAdmin(userId: String?, roles: String?) {
        if (userId.isNullOrBlank()) throw UnauthorizedException("요청자 신원이 없습니다")
        if (roles.orEmpty().split(',').none { it.trim() == ROLE_ADMIN }) throw ForbiddenException("창고는 어드민만 다룬다")
    }

    private fun GetWarehouseUseCase.Result.toResponse(): WarehouseResponse = WarehouseResponse(
        id = this.id,
        name = this.name,
        address = this.address,
        latitude = this.latitude,
        longitude = this.longitude,
        active = this.active,
    )

    private companion object {
        const val ROLE_ADMIN = "ROLE_ADMIN"
    }
}
