package com.kgd.place.infrastructure.persistence.region.adapter

import com.kgd.place.application.region.port.RegionRepositoryPort
import com.kgd.place.domain.region.model.Region
import com.kgd.place.domain.region.model.RegionLevel
import com.kgd.place.infrastructure.persistence.region.entity.RegionJpaEntity
import com.kgd.place.infrastructure.persistence.region.repository.RegionJpaRepository
import org.springframework.stereotype.Component

@Component
class RegionRepositoryAdapter(
    private val jpaRepository: RegionJpaRepository,
) : RegionRepositoryPort {

    override fun save(region: Region): Region =
        jpaRepository.save(RegionJpaEntity.fromDomain(region)).toDomain()

    override fun saveAll(regions: List<Region>): List<Region> =
        jpaRepository.saveAll(regions.map { RegionJpaEntity.fromDomain(it) }).map { it.toDomain() }

    override fun findById(id: Long): Region? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findByLevel(level: RegionLevel): List<Region> =
        jpaRepository.findByLevel(level).map { it.toDomain() }

    override fun findByParentId(parentId: Long): List<Region> =
        jpaRepository.findByParentId(parentId).map { it.toDomain() }

    override fun count(): Long = jpaRepository.count()
}
