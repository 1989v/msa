package com.kgd.quant.application.asset.catalog

import com.kgd.quant.application.port.persistence.AssetCatalogRepositoryPort
import com.kgd.quant.domain.asset.catalog.AssetCatalog
import com.kgd.quant.domain.asset.catalog.AssetCatalogId
import com.kgd.quant.domain.asset.catalog.AssetClass
import com.kgd.quant.domain.asset.catalog.AssetSource
import com.kgd.quant.domain.common.Clock
import org.springframework.stereotype.Service

/**
 * AssetCatalogUseCase — admin REST 와 ingest scheduler 양쪽이 사용.
 * Phase 1.5 — DEFAULT_TARGETS 대체.
 */
@Service
class AssetCatalogUseCase(
    private val repo: AssetCatalogRepositoryPort,
    private val clock: Clock,
) {
    suspend fun list(activeOnly: Boolean = false): List<AssetCatalog> = repo.findAll(activeOnly)

    suspend fun byId(id: AssetCatalogId): AssetCatalog? = repo.findById(id)

    suspend fun create(input: CreateInput): AssetCatalog {
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

    suspend fun update(id: AssetCatalogId, input: UpdateInput): AssetCatalog {
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

    suspend fun delete(id: AssetCatalogId) {
        repo.delete(id)
    }

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
