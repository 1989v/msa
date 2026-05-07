package com.kgd.quant.domain.asset.catalog

import java.time.Instant
import java.util.UUID

/**
 * AssetCatalog — ingest sidecar 가 가져갈 자산 카탈로그.
 * ADR-0033/0034 Phase 1.5 — 기존 scheduler.py 의 DEFAULT_TARGETS 하드코딩을 DB 로 이전.
 */

@JvmInline
value class AssetCatalogId(val value: UUID) {
    companion object {
        fun new(): AssetCatalogId = AssetCatalogId(UUID.randomUUID())
    }
}

enum class AssetClass {
    CRYPTO,
    STOCK_KR,
    STOCK_US,
}

enum class AssetSource {
    YFINANCE,
    FDR,
    ;
    val key: String get() = name.lowercase()

    companion object {
        fun ofKey(key: String): AssetSource =
            values().firstOrNull { it.key.equals(key, ignoreCase = true) }
                ?: error("unknown source: $key")
    }
}

data class AssetCatalog(
    val id: AssetCatalogId,
    val assetCode: String,
    val assetClass: AssetClass,
    val source: AssetSource,
    val displayName: String,
    val active: Boolean,
    val sortOrder: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    init {
        require(assetCode.isNotBlank()) { "assetCode required" }
        require(displayName.isNotBlank()) { "displayName required" }
    }

    fun update(
        displayName: String? = null,
        source: AssetSource? = null,
        active: Boolean? = null,
        sortOrder: Int? = null,
        now: Instant,
    ): AssetCatalog = copy(
        displayName = displayName ?: this.displayName,
        source = source ?: this.source,
        active = active ?: this.active,
        sortOrder = sortOrder ?: this.sortOrder,
        updatedAt = now,
    )

    companion object {
        fun create(
            assetCode: String,
            assetClass: AssetClass,
            source: AssetSource,
            displayName: String,
            active: Boolean = true,
            sortOrder: Int = 0,
            now: Instant,
        ): AssetCatalog = AssetCatalog(
            id = AssetCatalogId.new(),
            assetCode = assetCode,
            assetClass = assetClass,
            source = source,
            displayName = displayName,
            active = active,
            sortOrder = sortOrder,
            createdAt = now,
            updatedAt = now,
        )
    }
}
