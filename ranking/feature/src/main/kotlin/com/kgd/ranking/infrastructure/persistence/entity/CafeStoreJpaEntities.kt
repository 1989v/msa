package com.kgd.ranking.infrastructure.persistence.entity

import jakarta.persistence.*
import java.time.Instant
import java.time.LocalDate

@Entity @Table(name = "cafe_store_snapshot")
class CafeStoreSnapshotJpaEntity(
    @Id val id: Long = 1,
    val version: String = "", val sourceAsOf: LocalDate? = null,
    val fetchedAt: Instant = Instant.EPOCH, val projectionAsOf: Instant = Instant.EPOCH,
    val mappingRuleVersion: String = "",
)
@Entity @Table(name = "cafe_store")
class CafeStoreJpaEntity(
    @Id val storeKey: String = "", val brandSlug: String? = null, val brandName: String? = null,
    val storeName: String = "", val branchName: String? = null, val address: String = "",
    val latitude: Double = 0.0, val longitude: Double = 0.0, val areaCode: String? = null,
    val mappingStatus: String = "UNMAPPED", @Lob @Column(columnDefinition = "LONGTEXT") val rawJson: String = "{}",
    val missingRounds: Int = 0,
)
@Entity @Table(name = "cafe_store_area")
class CafeStoreAreaJpaEntity(
    @Id val code: String = "", val name: String = "", val level: String = "", val parentCode: String? = null,
    val latitude: Double? = null, val longitude: Double? = null, val centerSource: String = "",
    val sourceAsOf: LocalDate? = null,
)
