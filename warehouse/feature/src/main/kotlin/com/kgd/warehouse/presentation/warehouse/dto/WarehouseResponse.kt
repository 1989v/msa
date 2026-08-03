package com.kgd.warehouse.presentation.warehouse.dto

data class WarehouseResponse(
    val id: Long,
    val name: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val active: Boolean,
)
