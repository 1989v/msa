package com.kgd.quant.infrastructure.persistence.adapter

import com.kgd.quant.application.port.persistence.AssetCatalogRepositoryPort
import com.kgd.quant.domain.asset.catalog.AssetCatalog
import com.kgd.quant.domain.asset.catalog.AssetCatalogId
import com.kgd.quant.domain.asset.catalog.AssetClass
import com.kgd.quant.domain.asset.catalog.AssetSource
import com.kgd.quant.infrastructure.persistence.entity.AssetCatalogEntity
import com.kgd.quant.infrastructure.persistence.repository.AssetCatalogJpaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.springframework.stereotype.Component

@Component
class JpaAssetCatalogAdapter(
    private val jpa: AssetCatalogJpaRepository,
) : AssetCatalogRepositoryPort {

    override suspend fun findById(id: AssetCatalogId): AssetCatalog? = withContext(Dispatchers.IO) {
        jpa.findById(id.value).orElse(null)?.toDomain()
    }

    override suspend fun findByClassAndCode(assetClass: AssetClass, assetCode: String): AssetCatalog? =
        withContext(Dispatchers.IO) {
            jpa.findByAssetClassAndAssetCode(assetClass.name, assetCode)?.toDomain()
        }

    override suspend fun findAll(activeOnly: Boolean): List<AssetCatalog> = withContext(Dispatchers.IO) {
        val rows = if (activeOnly) {
            jpa.findAllByActiveTrueOrderBySortOrderAscDisplayNameAsc()
        } else {
            jpa.findAllByOrderBySortOrderAscDisplayNameAsc()
        }
        rows.map { it.toDomain() }
    }

    override suspend fun save(item: AssetCatalog): AssetCatalog = withContext(Dispatchers.IO) {
        val existing = jpa.findById(item.id.value).orElse(null)
        val entity = existing ?: AssetCatalogEntity(assetId = item.id.value)
        entity.apply {
            assetCode = item.assetCode
            assetClass = item.assetClass.name
            source = item.source.key
            displayName = item.displayName
            active = item.active
            sortOrder = item.sortOrder
            createdAt = item.createdAt
            updatedAt = item.updatedAt
        }
        jpa.save(entity)
        item
    }

    override suspend fun delete(id: AssetCatalogId) {
        withContext(Dispatchers.IO) { jpa.deleteById(id.value) }
    }

    private fun AssetCatalogEntity.toDomain(): AssetCatalog = AssetCatalog(
        id = AssetCatalogId(assetId),
        assetCode = assetCode,
        assetClass = AssetClass.valueOf(assetClass),
        source = AssetSource.ofKey(source),
        displayName = displayName,
        active = active,
        sortOrder = sortOrder,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}
