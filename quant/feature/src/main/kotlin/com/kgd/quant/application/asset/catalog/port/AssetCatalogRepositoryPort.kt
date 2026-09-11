package com.kgd.quant.application.asset.catalog.port

import com.kgd.quant.domain.asset.catalog.AssetCatalog
import com.kgd.quant.domain.asset.catalog.AssetCatalogId
import com.kgd.quant.domain.asset.AssetClass

/**
 * AssetCatalogRepositoryPort — 자산 카탈로그 영속성 포트.
 * Hexagonal — domain/application 은 어댑터 시그니처 인지.
 */
interface AssetCatalogRepositoryPort {
    suspend fun findById(id: AssetCatalogId): AssetCatalog?
    suspend fun findByClassAndCode(assetClass: AssetClass, assetCode: String): AssetCatalog?
    suspend fun findAll(activeOnly: Boolean = false): List<AssetCatalog>
    suspend fun save(item: AssetCatalog): AssetCatalog
    suspend fun delete(id: AssetCatalogId)
}
