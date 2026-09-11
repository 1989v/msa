package com.kgd.place.infrastructure.persistence.poi.adapter

import com.kgd.place.application.poi.port.PoiRepositoryPort
import com.kgd.place.domain.poi.model.Poi
import com.kgd.place.infrastructure.persistence.poi.entity.PoiJpaEntity
import com.kgd.place.infrastructure.persistence.poi.repository.PoiJpaRepository
import org.springframework.stereotype.Component

@Component
class PoiRepositoryAdapter(
    private val jpaRepository: PoiJpaRepository,
) : PoiRepositoryPort {

    override fun save(poi: Poi): Poi =
        jpaRepository.save(PoiJpaEntity.fromDomain(poi)).toDomain()

    override fun saveAll(pois: List<Poi>): List<Poi> =
        jpaRepository.saveAll(pois.map { PoiJpaEntity.fromDomain(it) }).map { it.toDomain() }

    override fun findById(id: Long): Poi? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun count(): Long = jpaRepository.count()
}
