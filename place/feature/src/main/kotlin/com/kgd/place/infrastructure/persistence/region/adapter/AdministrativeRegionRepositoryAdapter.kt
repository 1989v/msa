package com.kgd.place.infrastructure.persistence.region.adapter

import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.domain.region.model.AdministrativeRegion
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.infrastructure.persistence.region.entity.AdministrativeRegionJpaEntity
import com.kgd.place.infrastructure.persistence.region.repository.AdministrativeRegionJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class AdministrativeRegionRepositoryAdapter(
    private val jpaRepository: AdministrativeRegionJpaRepository,
) : AdministrativeRegionRepositoryPort {

    @Transactional
    override fun upsertAll(regions: List<AdministrativeRegion>): AdministrativeRegionRepositoryPort.UpsertSummary {
        if (regions.isEmpty()) return AdministrativeRegionRepositoryPort.UpsertSummary(0, 0)

        val existing = jpaRepository.findAllById(regions.map { it.code }).associateBy { it.code }
        var created = 0
        var updated = 0
        val entities = regions.map { incoming ->
            val current = existing[incoming.code]
            if (current == null) {
                created++
                AdministrativeRegionJpaEntity.fromDomain(incoming)
            } else {
                updated++
                // 좌표는 별도 경로(관광지 좌표)로 채우므로 적재가 덮어쓰지 않는다.
                val merged = current.toDomain().apply { syncFrom(incoming) }
                AdministrativeRegionJpaEntity.fromDomain(merged)
            }
        }
        jpaRepository.saveAll(entities)
        return AdministrativeRegionRepositoryPort.UpsertSummary(created, updated)
    }

    override fun findByLevel(level: AdministrativeRegionLevel): List<AdministrativeRegion> =
        jpaRepository.findByLevelOrderByCodeAsc(level).map { it.toDomain() }

    override fun findChildren(parentCode: String): List<AdministrativeRegion> =
        jpaRepository.findByParentCodeOrderByCodeAsc(parentCode).map { it.toDomain() }
}
