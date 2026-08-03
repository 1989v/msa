package com.kgd.warehouse.application.warehouse.usecase

interface CreateWarehouseUseCase {
    fun execute(command: Command): Result

    data class Command(val name: String, val address: String, val latitude: Double, val longitude: Double)
    data class Result(val id: Long, val name: String, val address: String, val active: Boolean)
}
