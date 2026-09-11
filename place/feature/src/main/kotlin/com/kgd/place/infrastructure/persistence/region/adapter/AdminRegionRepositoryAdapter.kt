package com.kgd.place.infrastructure.persistence.region.adapter

import com.kgd.place.application.region.port.AdminRegionRepositoryPort
import com.kgd.place.domain.region.model.AdminRegion
import com.kgd.place.domain.region.model.AdminRegionLevel
import com.kgd.place.infrastructure.persistence.region.entity.AdminRegionJpaEntity
import com.kgd.place.infrastructure.persistence.region.repository.AdminRegionJpaRepository
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class AdminRegionRepositoryAdapter(
    private val jpaRepository: AdminRegionJpaRepository,
) : AdminRegionRepositoryPort {

    @Transactional
    override fun upsertAll(regions: List<AdminRegion>): AdminRegionRepositoryPort.UpsertSummary {
        if (regions.isEmpty()) return AdminRegionRepositoryPort.UpsertSummary(0, 0)

        val existing = jpaRepository.findAllById(regions.map { it.code }).associateBy { it.code }
        var created = 0
        var updated = 0
        val entities = regions.map { incoming ->
            val current = existing[incoming.code]
            if (current == null) {
                created++
                AdminRegionJpaEntity.fromDomain(incoming)
            } else {
                updated++
                // 좌표는 별도 경로(관광지 좌표)로 채우므로 적재가 덮어쓰지 않는다.
                val merged = current.toDomain().apply { syncFrom(incoming) }
                AdminRegionJpaEntity.fromDomain(merged)
            }
        }
        jpaRepository.saveAll(entities)
        return AdminRegionRepositoryPort.UpsertSummary(created, updated)
    }

    override fun findByLevel(level: AdminRegionLevel): List<AdminRegion> =
        jpaRepository.findByLevelOrderByCodeAsc(level).map { it.toDomain() }

    override fun findChildren(parentCode: String): List<AdminRegion> =
        jpaRepository.findByParentCodeOrderByCodeAsc(parentCode).map { it.toDomain() }
}
