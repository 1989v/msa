package com.kgd.place.domain.market.model

/** A read projection; source values are never mutated by editorial decisions. */
data class MarketStoreDisplay(
    val name: String,
    val items: String?,
    val zoneId: Long?,
    val membership: MarketMembership,
    val coordinate: MarketCoordinate?,
    val pinKind: MarketPinKind,
) {
    companion object {
        fun from(store: MarketStore, overrides: List<MarketStoreOverride>): MarketStoreDisplay {
            require(overrides.all { it.storeId == store.id }) { "Override belongs to another store" }
            require(overrides.map { it.field }.distinct().size == overrides.size) { "Duplicate override field" }
            val fields = overrides.associateBy { it.field }
            require((MarketStoreField.LATITUDE in fields) == (MarketStoreField.LONGITUDE in fields)) {
                "Coordinate overrides require both latitude and longitude fields"
            }
            fun value(field: MarketStoreField, original: String?): String? =
                if (field in fields) fields.getValue(field).value else original
            val lat = value(MarketStoreField.LATITUDE, store.latitude?.toString())?.toDouble()
            val lng = value(MarketStoreField.LONGITUDE, store.longitude?.toString())?.toDouble()
            require((lat == null) == (lng == null)) { "Display coordinate requires both latitude and longitude" }
            val pinKind = MarketPinKind.valueOf(value(MarketStoreField.PIN_KIND, store.pinKind.name)!!)
            require(pinKind != MarketPinKind.REFERENCE ||
                (store.referenceStoreId != null && !store.relativePosition.isNullOrBlank()))
            return MarketStoreDisplay(
                name = value(MarketStoreField.NAME, store.name)!!,
                items = value(MarketStoreField.ITEMS, store.items),
                zoneId = value(MarketStoreField.ZONE_ID, store.zoneId?.toString())?.toLong(),
                membership = MarketMembership(MarketMembershipStatus.valueOf(
                    value(MarketStoreField.MEMBERSHIP, (store.judgedMembership ?: store.membership.status).name)!!)),
                coordinate = if (lat != null && lng != null) MarketCoordinate(lat, lng) else null,
                pinKind = pinKind,
            )
        }
    }
}
