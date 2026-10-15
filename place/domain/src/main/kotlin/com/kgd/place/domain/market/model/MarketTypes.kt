package com.kgd.place.domain.market.model

enum class MarketType { STREET, BUILDING, MIXED }
enum class MarketZoneKind { ROAD, BUILDING, FLOOR, CUSTOM }
enum class MarketZoneSource { AUTO, MANUAL }
enum class MarketStoreSource { ONNURI, SANGGA, MANUAL }
enum class MarketMembershipStatus { IN, OUT, UNKNOWN }
enum class MarketPinKind { EXACT, REFERENCE }
enum class MarketActorKind { ADMIN, STEWARD }
enum class MarketChangeTarget { MARKET, ZONE, STORE, BOUNDARY, PATH, ENTRANCE, ROAD_RULE, MARKET_GEO }
enum class MarketChangeAction { CREATE, UPDATE, DELETE, REVERT }
enum class MarketStewardStatus { PENDING, ACTIVE, SUSPENDED, REJECTED }
enum class MarketStoreField { NAME, ITEMS, MEMBERSHIP, ZONE_ID, LATITUDE, LONGITUDE, PIN_KIND }

/** Stores the automatic decision; an override never rewrites this evidence. */
data class MarketMembership(val status: MarketMembershipStatus) {
    val visibleByDefault: Boolean get() = status != MarketMembershipStatus.OUT
}

/** Validated display coordinate. Raw upstream strings stay in the source payload. */
data class MarketCoordinate(val latitude: Double, val longitude: Double) {
    init {
        require(latitude.isFinite() && latitude in -90.0..90.0) { "Invalid latitude" }
        require(longitude.isFinite() && longitude in -180.0..180.0) { "Invalid longitude" }
    }
}
