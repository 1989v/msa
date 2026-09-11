package com.kgd.quant.infrastructure.persistence.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant
import java.util.UUID

/**
 * AssetCatalogEntity — `quant_asset_catalog` 테이블 매핑 (V20260507_001).
 */
@Entity
@Table(
    name = "quant_asset_catalog",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_asset_catalog_class_code", columnNames = ["asset_class", "asset_code"]),
    ],
)
class AssetCatalogEntity(
    @Id
    @Column(name = "asset_id", columnDefinition = "BINARY(16)", nullable = false)
    var assetId: UUID = UUID.randomUUID(),

    @Column(name = "asset_code", nullable = false, length = 64)
    var assetCode: String = "",

    @Column(name = "asset_class", nullable = false, length = 32)
    var assetClass: String = "",

    @Column(name = "source", nullable = false, length = 32)
    var source: String = "",

    @Column(name = "display_name", nullable = false, length = 128)
    var displayName: String = "",

    @Column(name = "active", nullable = false)
    var active: Boolean = true,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)
