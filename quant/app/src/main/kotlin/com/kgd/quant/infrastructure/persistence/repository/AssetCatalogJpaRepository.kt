package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.AssetCatalogEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface AssetCatalogJpaRepository : JpaRepository<AssetCatalogEntity, UUID> {
    fun findAllByActiveTrueOrderBySortOrderAscDisplayNameAsc(): List<AssetCatalogEntity>
    fun findAllByOrderBySortOrderAscDisplayNameAsc(): List<AssetCatalogEntity>
    fun findByAssetClassAndAssetCode(assetClass: String, assetCode: String): AssetCatalogEntity?
}
