package com.kgd.codedictionary.infrastructure.persistence.portal.repository

import com.kgd.codedictionary.domain.portal.model.TileStatus
import com.kgd.codedictionary.infrastructure.persistence.portal.entity.PortalTileJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface PortalTileJpaRepository : JpaRepository<PortalTileJpaEntity, Long> {
    fun findAllByOrderByOrderNoAsc(): List<PortalTileJpaEntity>
    fun findAllByStatusNotOrderByOrderNoAsc(status: TileStatus): List<PortalTileJpaEntity>
    fun findByCode(code: String): PortalTileJpaEntity?
}
