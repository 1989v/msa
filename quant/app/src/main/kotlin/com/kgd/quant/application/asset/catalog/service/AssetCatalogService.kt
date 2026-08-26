package com.kgd.quant.application.asset.catalog.service

import com.kgd.quant.application.asset.catalog.port.AssetCatalogRepositoryPort
import com.kgd.quant.application.asset.catalog.usecase.AssetCatalogUseCase
import com.kgd.quant.domain.asset.catalog.AssetCatalog
import com.kgd.quant.domain.asset.catalog.AssetCatalogId
import com.kgd.quant.domain.common.Clock
import org.springframework.stereotype.Service

/**
 * AssetCatalogService — admin REST 와 ingest scheduler 양쪽이 사용.
 * Phase 1.5 — DEFAULT_TARGETS 대체.
 */
@Service
class AssetCatalogService(
    private val repo: AssetCatalogRepositoryPort,
    private val clock: Clock,
) : AssetCatalogUseCase {
    override suspend fun list(activeOnly: Boolean): List<AssetCatalog> = repo.findAll(activeOnly)

    override suspend fun byId(id: AssetCatalogId): AssetCatalog? = repo.findById(id)

    override suspend fun create(input: AssetCatalogUseCase.CreateInput): AssetCatalog {
        val existing = repo.findByClassAndCode(input.assetClass, input.assetCode)
        if (existing != null) error("asset already exists: ${input.assetClass}/${input.assetCode}")
        val now = clock.now()
        return repo.save(
            AssetCatalog.create(
                assetCode = input.assetCode,
                assetClass = input.assetClass,
                source = input.source,
                displayName = input.displayName,
                active = input.active,
                sortOrder = input.sortOrder,
                now = now,
            )
        )
    }

    override suspend fun update(id: AssetCatalogId, input: AssetCatalogUseCase.UpdateInput): AssetCatalog {
        val current = repo.findById(id) ?: error("asset not found: $id")
        val updated = current.update(
            displayName = input.displayName,
            source = input.source,
            active = input.active,
            sortOrder = input.sortOrder,
            now = clock.now(),
        )
        return repo.save(updated)
    }

    override suspend fun delete(id: AssetCatalogId) {
        repo.delete(id)
    }

}
