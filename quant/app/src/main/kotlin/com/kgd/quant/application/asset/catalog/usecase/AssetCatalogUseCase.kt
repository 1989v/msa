package com.kgd.quant.application.asset.catalog.usecase

import com.kgd.quant.domain.asset.catalog.AssetCatalog
import com.kgd.quant.domain.asset.catalog.AssetCatalogId
import com.kgd.quant.domain.asset.AssetClass
import com.kgd.quant.domain.asset.catalog.AssetSource

/** 자산 카탈로그 CRUD — admin REST 와 ingest scheduler 양쪽이 사용 (Phase 1.5) */
interface AssetCatalogUseCase {
    suspend fun list(activeOnly: Boolean = false): List<AssetCatalog>
    suspend fun byId(id: AssetCatalogId): AssetCatalog?
    suspend fun create(input: CreateInput): AssetCatalog
    suspend fun update(id: AssetCatalogId, input: UpdateInput): AssetCatalog
    suspend fun delete(id: AssetCatalogId)

    data class CreateInput(
        val assetCode: String,
        val assetClass: AssetClass,
        val source: AssetSource,
        val displayName: String,
        val active: Boolean = true,
        val sortOrder: Int = 0,
    )

    data class UpdateInput(
        val displayName: String? = null,
        val source: AssetSource? = null,
        val active: Boolean? = null,
        val sortOrder: Int? = null,
    )
}
