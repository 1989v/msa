package com.kgd.warehouse.application.warehouse.usecase

interface GetWarehouseUseCase {
    fun findById(id: Long): Result
    fun findAll(): List<Result>
    fun findDefaultWarehouse(): Result

    data class Result(val id: Long, val name: String, val address: String, val latitude: Double, val longitude: Double, val active: Boolean)
}
