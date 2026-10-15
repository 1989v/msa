package com.kgd.place.infrastructure.persistence.market.entity

import com.kgd.place.domain.market.model.MarketActorKind
import com.kgd.place.domain.market.model.MarketMembership
import com.kgd.place.domain.market.model.MarketMembershipStatus
import com.kgd.place.domain.market.model.MarketPinKind
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketJudgedBy
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "market_store")
class MarketStoreJpaEntity(
    @Column(name = "market_id", nullable = false)
    val marketId: Long,
    @Column(name = "name", nullable = false, length = 300)
    val name: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val source: MarketStoreSource,
    @Column(name = "source_key", nullable = true, length = 191)
    val sourceKey: String?,
    @Column(name = "zone_id", nullable = true)
    val zoneId: Long?,
    @Column(name = "items", nullable = true, columnDefinition = "text")
    val items: String?,
    @Column(name = "category_major", nullable = true, length = 100)
    val categoryMajor: String?,
    @Column(name = "category_mid", nullable = true, length = 100)
    val categoryMid: String?,
    @Column(name = "category_sub", nullable = true, length = 100)
    val categorySub: String?,
    @Column(name = "latitude", nullable = true)
    val latitude: Double?,
    @Column(name = "longitude", nullable = true)
    val longitude: Double?,
    @Column(name = "road_address", nullable = true, length = 500)
    val roadAddress: String?,
    @Column(name = "jibun_address", nullable = true, length = 500)
    val jibunAddress: String?,
    @Column(name = "building_management_no", nullable = true, length = 100)
    val buildingManagementNo: String?,
    @Column(name = "building_name", nullable = true, length = 300)
    val buildingName: String?,
    @Column(name = "dong", nullable = true, length = 100)
    val dong: String?,
    @Column(name = "floor", nullable = true, length = 100)
    val floor: String?,
    @Column(name = "ho", nullable = true, length = 100)
    val ho: String?,
    @Column(name = "road_name", nullable = true, length = 300)
    val roadName: String?,
    @Column(name = "onnuri_key", nullable = true, length = 191)
    val onnuriKey: String?,
    @Column(name = "sangga_key", nullable = true, length = 191)
    val sanggaKey: String?,
    @Column(name = "onnuri_raw", nullable = true, columnDefinition = "json")
    val onnuriRaw: String?,
    @Column(name = "sangga_raw", nullable = true, columnDefinition = "json")
    val sanggaRaw: String?,
    @Enumerated(EnumType.STRING)
    @Column(name = "membership", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val membership: MarketMembershipStatus,
    @Enumerated(EnumType.STRING)
    @Column(name = "pin_kind", nullable = false, length = 20, columnDefinition = "varchar(20)")
    val pinKind: MarketPinKind,
    @Column(name = "reference_store_id", nullable = true)
    val referenceStoreId: Long?,
    @Column(name = "relative_position", nullable = true, length = 100)
    val relativePosition: String?,
    @Column(name = "position_note", nullable = true, columnDefinition = "text")
    val positionNote: String?,
    @Enumerated(EnumType.STRING)
    @Column(name = "actor_kind", nullable = true, length = 20, columnDefinition = "varchar(20)")
    val actorKind: MarketActorKind?,
    @Column(name = "created_by_member_id", nullable = true)
    val createdByMemberId: Long?,
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime,
    @Enumerated(EnumType.STRING)
    @Column(name = "judged_membership", nullable = true, length = 20, columnDefinition = "varchar(20)")
    val judgedMembership: MarketMembershipStatus? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "judged_by", nullable = true, length = 20, columnDefinition = "varchar(20)")
    val judgedBy: MarketJudgedBy? = null,
    @Column(name = "path_id", nullable = true)
    val pathId: Long? = null,
    @Column(name = "needs_review", nullable = false)
    val needsReview: Boolean = false,
    @Column(name = "good_price_key", nullable = true, length = 64)
    val goodPriceKey: String? = null,
    @Column(name = "good_price_raw", nullable = true, columnDefinition = "text")
    val goodPriceRaw: String? = null,
    @Column(name = "good_price_matched_by", nullable = true, length = 16)
    val goodPriceMatchedBy: String? = null,
    @Column(name = "good_price_menu_names", nullable = true, length = 500)
    val goodPriceMenuNames: String? = null,
) {
    fun toDomain(): MarketStore = MarketStore(
        marketId = marketId,
        name = name,
        source = source,
        sourceKey = sourceKey,
        zoneId = zoneId,
        items = items,
        categoryMajor = categoryMajor,
        categoryMid = categoryMid,
        categorySub = categorySub,
        latitude = latitude,
        longitude = longitude,
        roadAddress = roadAddress,
        jibunAddress = jibunAddress,
        buildingManagementNo = buildingManagementNo,
        buildingName = buildingName,
        dong = dong,
        floor = floor,
        ho = ho,
        roadName = roadName,
        onnuriKey = onnuriKey,
        sanggaKey = sanggaKey,
        onnuriRaw = onnuriRaw,
        sanggaRaw = sanggaRaw,
        membership = MarketMembership(membership),
        pinKind = pinKind,
        referenceStoreId = referenceStoreId,
        relativePosition = relativePosition,
        positionNote = positionNote,
        actorKind = actorKind,
        createdByMemberId = createdByMemberId,
        id = id,
        createdAt = createdAt,
        judgedMembership = judgedMembership,
        judgedBy = judgedBy,
        pathId = pathId,
        needsReview = needsReview,
        goodPriceKey = goodPriceKey,
        goodPriceRaw = goodPriceRaw,
        goodPriceMatchedBy = goodPriceMatchedBy,
        goodPriceMenuNames = goodPriceMenuNames,

    )

    companion object {
        fun fromDomain(row: MarketStore): MarketStoreJpaEntity = MarketStoreJpaEntity(
            marketId = row.marketId,
            name = row.name,
            source = row.source,
            sourceKey = row.sourceKey,
            zoneId = row.zoneId,
            items = row.items,
            categoryMajor = row.categoryMajor,
            categoryMid = row.categoryMid,
            categorySub = row.categorySub,
            latitude = row.latitude,
            longitude = row.longitude,
            roadAddress = row.roadAddress,
            jibunAddress = row.jibunAddress,
            buildingManagementNo = row.buildingManagementNo,
            buildingName = row.buildingName,
            dong = row.dong,
            floor = row.floor,
            ho = row.ho,
            roadName = row.roadName,
            onnuriKey = row.onnuriKey,
            sanggaKey = row.sanggaKey,
            onnuriRaw = row.onnuriRaw,
            sanggaRaw = row.sanggaRaw,
            membership = row.membership.status,
            pinKind = row.pinKind,
            referenceStoreId = row.referenceStoreId,
            relativePosition = row.relativePosition,
            positionNote = row.positionNote,
            actorKind = row.actorKind,
            createdByMemberId = row.createdByMemberId,
            id = row.id,
            createdAt = row.createdAt,
            judgedMembership = row.judgedMembership,
            judgedBy = row.judgedBy,
            pathId = row.pathId,
            needsReview = row.needsReview,
            goodPriceKey = row.goodPriceKey,
            goodPriceRaw = row.goodPriceRaw,
            goodPriceMatchedBy = row.goodPriceMatchedBy,
            goodPriceMenuNames = row.goodPriceMenuNames,

        )
    }
}
