package com.kgd.place.application.region.service

import com.kgd.place.application.region.port.AdminRegionRepositoryPort
import com.kgd.place.application.region.usecase.AdminRegionUseCase
import com.kgd.place.domain.region.model.AdminRegion
import com.kgd.place.domain.region.model.AdminRegionLevel
import org.springframework.stereotype.Service

@Service
class AdminRegionService(
    private val adminRegionRepository: AdminRegionRepositoryPort,
) : AdminRegionUseCase {

    override fun upsertAll(commands: List<AdminRegionUseCase.Command>): AdminRegionUseCase.Result {
        val summary = adminRegionRepository.upsertAll(
            commands.map {
                AdminRegion.create(
                    code = it.code,
                    level = it.level,
                    name = it.name,
                    parentCode = it.parentCode,
                    nameEn = it.nameEn,
                    latitude = it.latitude,
                    longitude = it.longitude,
                )
            },
        )
        return AdminRegionUseCase.Result(summary.created, summary.updated)
    }

    override fun find(level: AdminRegionLevel, parentCode: String?): List<AdminRegionUseCase.View> =
        when {
            parentCode != null -> adminRegionRepository.findChildren(parentCode)
            else -> adminRegionRepository.findByLevel(level)
        }.map { it.toView() }

    private fun AdminRegion.toView() = AdminRegionUseCase.View(
        code = code,
        parentCode = parentCode,
        level = level,
        name = name,
        nameEn = nameEn,
        latitude = latitude,
        longitude = longitude,
    )
}
