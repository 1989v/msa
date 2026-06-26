package com.kgd.warehouse.presentation.warehouse.dto

import jakarta.validation.constraints.NotBlank

data class CreateWarehouseRequest(
    @field:NotBlank(message = "창고명은 필수입니다")
    val name: String,
    @field:NotBlank(message = "주소는 필수입니다")
    val address: String,
    val latitude: Double,
    val longitude: Double,
)
