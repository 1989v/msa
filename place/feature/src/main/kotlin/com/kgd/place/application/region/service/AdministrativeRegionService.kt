package com.kgd.place.application.region.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.application.region.usecase.AdministrativeRegionUseCase
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.domain.region.model.AdministrativeRegion
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import org.springframework.stereotype.Service

@Service
class AdministrativeRegionService(
    private val administrativeRegionRepository: AdministrativeRegionRepositoryPort,
    private val attractionRepository: AttractionRepositoryPort,
) : AdministrativeRegionUseCase {

    override fun upsertAll(commands: List<AdministrativeRegionUseCase.Command>): AdministrativeRegionUseCase.Result {
        val summary = administrativeRegionRepository.upsertAll(
            commands.map {
                AdministrativeRegion.create(
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
        return AdministrativeRegionUseCase.Result(summary.created, summary.updated)
    }

    override fun find(
        level: AdministrativeRegionLevel,
        parentCode: String?,
        countLang: String?,
    ): List<AdministrativeRegionUseCase.View> {
        val regions = when {
            parentCode != null -> administrativeRegionRepository.findChildren(parentCode)
            else -> administrativeRegionRepository.findByLevel(level)
        }
        if (countLang == null) return regions.map { it.toView() }

        /*
         * 시도는 그 아래 시군구 건수의 합이다 — 한 번의 group by 로 두 레벨을 다 만든다.
         * 레벨마다 따로 세면 합이 안 맞는 순간이 생기고, 그건 화면에서 알아채기 어렵다.
         */
        val counts = attractionRepository.countByLdong(countLang, Attraction.SIGHT_CATEGORIES)
        val bySigungu = counts.associate { "${it.regnCode}${it.signguCode.orEmpty()}" to it.total }
        val bySido = counts.groupBy { it.regnCode }.mapValues { (_, rows) -> rows.sumOf { it.total } }

        return regions.map { region ->
            val total = when (region.level) {
                AdministrativeRegionLevel.SIDO -> bySido[region.code] ?: 0
                AdministrativeRegionLevel.SIGUNGU -> bySigungu[region.code] ?: 0
            }
            region.toView().copy(attractionCount = total)
        }
    }

    private fun AdministrativeRegion.toView() = AdministrativeRegionUseCase.View(
        code = code,
        parentCode = parentCode,
        level = level,
        name = name,
        nameEn = nameEn,
        latitude = latitude,
        longitude = longitude,
    )
}
