package com.kgd.place.domain.market.model

import java.time.LocalDateTime

data class MarketStoreOverride(
    val storeId: Long,
    val field: MarketStoreField,
    val value: String?,
    val reason: String,
    val memberId: Long,
    val actorKind: MarketActorKind,
    val id: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(storeId > 0 && memberId > 0 && reason.isNotBlank())
        when (field) {
            MarketStoreField.NAME -> require(!value.isNullOrBlank())
            MarketStoreField.ITEMS -> Unit
            MarketStoreField.MEMBERSHIP -> require(MarketMembershipStatus.entries.any { it.name == value })
            MarketStoreField.PIN_KIND -> require(MarketPinKind.entries.any { it.name == value })
            MarketStoreField.ZONE_ID -> require(value == null || (value.toLongOrNull()?.let { it > 0 } == true))
            MarketStoreField.LATITUDE -> require(value == null || (value.toDoubleOrNull()?.let { it.isFinite() && it in -90.0..90.0 } == true))
            MarketStoreField.LONGITUDE -> require(value == null || (value.toDoubleOrNull()?.let { it.isFinite() && it in -180.0..180.0 } == true))
        }
    }
}
