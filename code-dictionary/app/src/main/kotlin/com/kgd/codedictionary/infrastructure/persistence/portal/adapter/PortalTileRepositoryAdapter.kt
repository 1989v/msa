package com.kgd.codedictionary.infrastructure.persistence.portal.adapter

import com.kgd.codedictionary.application.portal.port.PortalTileRepositoryPort
import com.kgd.codedictionary.domain.portal.model.PortalTile
import com.kgd.codedictionary.domain.portal.model.TileStatus
import com.kgd.codedictionary.infrastructure.persistence.portal.entity.PortalTileJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.portal.repository.PortalTileJpaRepository
import org.springframework.stereotype.Component

@Component
class PortalTileRepositoryAdapter(
    private val jpaRepository: PortalTileJpaRepository,
) : PortalTileRepositoryPort {

    override fun findAllVisible(): List<PortalTile> =
        jpaRepository.findAllByStatusNotOrderByOrderNoAsc(TileStatus.HIDDEN)
            .map(PortalTileJpaEntity::toDomain)

    override fun findAll(): List<PortalTile> =
        jpaRepository.findAllByOrderByOrderNoAsc().map(PortalTileJpaEntity::toDomain)

    /** code 는 불변 식별자다 — 기존 행이 있으면 id 없이 올려도 갱신으로 처리한다. */
    override fun save(tile: PortalTile): PortalTile {
        val existing = tile.id?.let { jpaRepository.findById(it).orElse(null) }
            ?: jpaRepository.findByCode(tile.code)
        return if (existing == null) {
            jpaRepository.save(PortalTileJpaEntity.fromDomain(tile)).toDomain()
        } else {
            existing.update(tile)
            existing.toDomain()
        }
    }

    override fun delete(id: Long) = jpaRepository.deleteById(id)
}
