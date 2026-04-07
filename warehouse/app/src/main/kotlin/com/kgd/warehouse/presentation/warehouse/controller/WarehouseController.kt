package com.kgd.warehouse.presentation.warehouse.controller

import com.kgd.common.response.ApiResponse
import com.kgd.warehouse.application.warehouse.usecase.CreateWarehouseUseCase
import com.kgd.warehouse.application.warehouse.usecase.GetWarehouseUseCase
import com.kgd.warehouse.presentation.warehouse.dto.CreateWarehouseRequest
import com.kgd.warehouse.presentation.warehouse.dto.WarehouseResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/warehouses")
class WarehouseController(
    private val createWarehouseUseCase: CreateWarehouseUseCase,
    private val getWarehouseUseCase: GetWarehouseUseCase,
) {

    @PostMapping
    fun create(@Valid @RequestBody request: CreateWarehouseRequest): ResponseEntity<ApiResponse<WarehouseResponse>> {
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
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(response))
    }

    @GetMapping
    fun findAll(): ResponseEntity<ApiResponse<List<WarehouseResponse>>> {
        val results = getWarehouseUseCase.findAll().map { it.toResponse() }
        return ResponseEntity.ok(ApiResponse.success(results))
    }

    @GetMapping("/{id}")
    fun findById(@PathVariable id: Long): ResponseEntity<ApiResponse<WarehouseResponse>> {
        val result = getWarehouseUseCase.findById(id)
        return ResponseEntity.ok(ApiResponse.success(result.toResponse()))
    }

    @GetMapping("/default")
    fun findDefault(): ResponseEntity<ApiResponse<WarehouseResponse>> {
        val result = getWarehouseUseCase.findDefaultWarehouse()
        return ResponseEntity.ok(ApiResponse.success(result.toResponse()))
    }

    private fun GetWarehouseUseCase.Result.toResponse(): WarehouseResponse = WarehouseResponse(
        id = this.id,
        name = this.name,
        address = this.address,
        latitude = this.latitude,
        longitude = this.longitude,
        active = this.active,
    )
}
