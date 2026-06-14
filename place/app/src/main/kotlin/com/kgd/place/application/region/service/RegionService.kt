package com.kgd.place.application.region.service

import com.kgd.place.application.region.port.RegionRepositoryPort
import com.kgd.place.application.region.usecase.CreateRegionUseCase
import com.kgd.place.application.region.usecase.GetRegionUseCase
import com.kgd.place.domain.region.exception.RegionNotFoundException
import com.kgd.place.domain.region.model.Region
import com.kgd.place.domain.region.model.RegionLevel
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class RegionService(
    private val regionRepository: RegionRepositoryPort,
) : CreateRegionUseCase, GetRegionUseCase {

    override fun execute(command: CreateRegionUseCase.Command): CreateRegionUseCase.Result =
        regionRepository.save(command.toDomain()).toResult()

    override fun executeBulk(commands: List<CreateRegionUseCase.Command>): List<CreateRegionUseCase.Result> =
        regionRepository.saveAll(commands.map { it.toDomain() }).map { it.toResult() }

    @Transactional(readOnly = true)
    override fun findById(id: Long): GetRegionUseCase.RegionView =
        (regionRepository.findById(id) ?: throw RegionNotFoundException(id)).toView()

    @Transactional(readOnly = true)
    override fun findByLevel(level: RegionLevel): List<GetRegionUseCase.RegionView> =
        regionRepository.findByLevel(level).map { it.toView() }

    @Transactional(readOnly = true)
    override fun findChildren(parentId: Long): List<GetRegionUseCase.RegionView> =
        regionRepository.findByParentId(parentId).map { it.toView() }

    private fun CreateRegionUseCase.Command.toDomain(): Region = Region.create(
        level = level,
        name = name,
        parentId = parentId,
        nameKo = nameKo,
        countryCode = countryCode,
        admin1Code = admin1Code,
        admin2Code = admin2Code,
        geonamesId = geonamesId,
        latitude = latitude,
        longitude = longitude,
        population = population,
    )

    private fun Region.toResult() = CreateRegionUseCase.Result(
        id = requireNotNull(id) { "저장된 지역에 ID가 없습니다" },
        level = level,
        name = name,
        nameKo = nameKo,
        countryCode = countryCode,
        latitude = latitude,
        longitude = longitude,
    )

    private fun Region.toView() = GetRegionUseCase.RegionView(
        id = requireNotNull(id) { "지역 ID가 null입니다" },
        parentId = parentId,
        level = level,
        name = name,
        nameKo = nameKo,
        countryCode = countryCode,
        admin1Code = admin1Code,
        admin2Code = admin2Code,
        latitude = latitude,
        longitude = longitude,
        population = population,
    )
}
