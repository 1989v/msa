package com.kgd.warehouse.application.warehouse.service

import com.kgd.warehouse.application.warehouse.port.WarehouseRepositoryPort
import com.kgd.warehouse.application.warehouse.usecase.CreateWarehouseUseCase
import com.kgd.warehouse.application.warehouse.usecase.GetWarehouseUseCase
import com.kgd.warehouse.domain.warehouse.exception.NoActiveWarehouseException
import com.kgd.warehouse.domain.warehouse.exception.WarehouseNotFoundException
import com.kgd.warehouse.domain.warehouse.model.Warehouse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class WarehouseService(
    private val warehouseRepository: WarehouseRepositoryPort,
) : CreateWarehouseUseCase, GetWarehouseUseCase {

    override fun execute(command: CreateWarehouseUseCase.Command): CreateWarehouseUseCase.Result {
        val warehouse = Warehouse.create(
            name = command.name,
            address = command.address,
            latitude = command.latitude,
            longitude = command.longitude,
        )
        val saved = warehouseRepository.save(warehouse)
        val id = saved.id ?: throw IllegalStateException("저장된 창고의 ID가 null입니다")
        return CreateWarehouseUseCase.Result(
            id = id,
            name = saved.name,
            address = saved.address,
            active = saved.active,
        )
    }

    @Transactional(readOnly = true)
    override fun findById(id: Long): GetWarehouseUseCase.Result {
        val warehouse = warehouseRepository.findById(id)
            ?: throw WarehouseNotFoundException(id)
        return warehouse.toResult()
    }

    @Transactional(readOnly = true)
    override fun findAll(): List<GetWarehouseUseCase.Result> {
        return warehouseRepository.findAll().map { it.toResult() }
    }

    @Transactional(readOnly = true)
    override fun findDefaultWarehouse(): GetWarehouseUseCase.Result {
        val warehouse = warehouseRepository.findFirstActiveWarehouse()
            ?: throw NoActiveWarehouseException()
        return warehouse.toResult()
    }

    private fun Warehouse.toResult(): GetWarehouseUseCase.Result {
        val warehouseId = this.id ?: throw IllegalStateException("창고 ID가 null입니다")
        return GetWarehouseUseCase.Result(
            id = warehouseId,
            name = this.name,
            address = this.address,
            latitude = this.latitude,
            longitude = this.longitude,
            active = this.active,
        )
    }
}
