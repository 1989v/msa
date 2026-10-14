package com.kgd.place.domain.market.model

import java.time.LocalDateTime

data class MarketStore(
    val marketId: Long,
    val name: String,
    val source: MarketStoreSource,
    val sourceKey: String? = null,
    val zoneId: Long? = null,
    val items: String? = null,
    val categoryMajor: String? = null,
    val categoryMid: String? = null,
    val categorySub: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val roadAddress: String? = null,
    val jibunAddress: String? = null,
    val buildingManagementNo: String? = null,
    val buildingName: String? = null,
    val dong: String? = null,
    val floor: String? = null,
    val ho: String? = null,
    val roadName: String? = null,
    val onnuriKey: String? = null,
    val sanggaKey: String? = null,
    val onnuriRaw: String? = null,
    val sanggaRaw: String? = null,
    val membership: MarketMembership = MarketMembership(MarketMembershipStatus.UNKNOWN),
    val pinKind: MarketPinKind = MarketPinKind.EXACT,
    val referenceStoreId: Long? = null,
    val relativePosition: String? = null,
    val positionNote: String? = null,
    val actorKind: MarketActorKind? = null,
    val createdByMemberId: Long? = null,
    val id: Long? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(marketId > 0 && name.isNotBlank())
        require((latitude == null) == (longitude == null))
        if (latitude != null && longitude != null) MarketCoordinate(latitude, longitude)
        require(source == MarketStoreSource.MANUAL || !sourceKey.isNullOrBlank())
        require(source != MarketStoreSource.ONNURI || (!onnuriKey.isNullOrBlank() && !onnuriRaw.isNullOrBlank()))
        require(source != MarketStoreSource.SANGGA || (!sanggaKey.isNullOrBlank() && !sanggaRaw.isNullOrBlank()))
        require(source != MarketStoreSource.MANUAL || (actorKind != null && createdByMemberId != null))
        require(pinKind != MarketPinKind.REFERENCE || (referenceStoreId != null && !relativePosition.isNullOrBlank()))
    }

    /** Only upstream-owned fields are replaced; ID, manual provenance and overrides remain stable. */
    fun reloadSource(incoming: MarketStore): MarketStore {
        require(source != MarketStoreSource.MANUAL && incoming.source != MarketStoreSource.MANUAL)
        require(marketId == incoming.marketId && source == incoming.source && sourceKey == incoming.sourceKey)
        val retainSangga = incoming.sanggaRaw == null && sanggaRaw != null
        return incoming.copy(id = id, createdAt = createdAt,
            onnuriKey = incoming.onnuriKey ?: onnuriKey, onnuriRaw = incoming.onnuriRaw ?: onnuriRaw,
            sanggaKey = incoming.sanggaKey ?: sanggaKey, sanggaRaw = incoming.sanggaRaw ?: sanggaRaw,
            latitude = if (retainSangga) latitude else incoming.latitude,
            longitude = if (retainSangga) longitude else incoming.longitude,
            categoryMajor = if (retainSangga) categoryMajor else incoming.categoryMajor,
            categoryMid = if (retainSangga) categoryMid else incoming.categoryMid,
            categorySub = if (retainSangga) categorySub else incoming.categorySub,
            buildingManagementNo = if (retainSangga) buildingManagementNo else incoming.buildingManagementNo,
            buildingName = if (retainSangga) buildingName else incoming.buildingName,
            dong = if (retainSangga) dong else incoming.dong,
            floor = if (retainSangga) floor else incoming.floor,
            ho = if (retainSangga) ho else incoming.ho,
            roadName = if (retainSangga) roadName else incoming.roadName,
            roadAddress = incoming.roadAddress ?: if (retainSangga) roadAddress else null,
            jibunAddress = incoming.jibunAddress ?: if (retainSangga) jibunAddress else null,
            items = if (incoming.onnuriRaw == null && onnuriRaw != null) items else incoming.items,
        )
    }
}
