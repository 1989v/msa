package com.kgd.place.infrastructure.persistence.market.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

/** Rebuildable effective-IN projection; source JSON and editorial history remain in their own tables. */
@Entity
@Table(name = "market_store_search")
class MarketStoreSearchJpaEntity(
    @Id @Column(name = "store_id") val storeId: Long,
    @Column(name = "market_id", nullable = false) val marketId: Long,
    @Column(name = "partner_id") val partnerId: Long?,
    @Column(columnDefinition = "text") val name: String?,
    @Column(columnDefinition = "text") val items: String?,
    @Column(name = "category_major", length = 100) val categoryMajor: String?,
    @Column(name = "category_mid", length = 100) val categoryMid: String?,
    @Column(name = "category_sub", length = 100) val categorySub: String?,
    @Column(name = "menu_names", columnDefinition = "text") val menuNames: String?,
    @Column(name = "name_roman", columnDefinition = "text") val nameRoman: String? = null,
)
