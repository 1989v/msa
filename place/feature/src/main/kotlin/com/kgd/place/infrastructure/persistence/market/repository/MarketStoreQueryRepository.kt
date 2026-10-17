package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.domain.market.model.MarketMembership
import com.kgd.place.domain.market.model.MarketStore
import com.kgd.place.infrastructure.persistence.market.entity.QMarketStoreJpaEntity
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Repository

@Repository
class MarketStoreQueryRepository(@Qualifier("placeJpaQueryFactory") private val factory: JPAQueryFactory) {
    private val s = QMarketStoreJpaEntity.marketStoreJpaEntity

    fun findForDisplay(marketId: Long): List<MarketStore> {
        val hasOnnuri = s.onnuriRaw.isNotNull
        val hasSangga = s.sanggaRaw.isNotNull
        return factory.select(
            s.marketId, s.name, s.source, s.sourceKey, s.zoneId,
            s.items, s.categoryMajor, s.categoryMid, s.categorySub, s.latitude,
            s.longitude, s.roadAddress, s.jibunAddress, s.buildingManagementNo, s.buildingName,
            s.dong, s.floor, s.ho, s.roadName, s.onnuriKey,
            s.sanggaKey, s.membership, s.pinKind, s.referenceStoreId, s.relativePosition,
            s.positionNote, s.actorKind, s.createdByMemberId, s.id, s.createdAt,
            s.judgedMembership, s.judgedBy, s.pathId, s.needsReview, s.goodPriceKey,
            s.goodPriceRaw, s.goodPriceMatchedBy, s.goodPriceMenuNames, s.identityKey, s.pairedStoreId,
            s.tourContentId, s.tourFirstMenu, s.tourTreatMenu, s.tourMatchedAt, hasOnnuri,
            hasSangga,
        // Sorted here, not in SQL: ORDER BY over this many text columns makes MySQL filesort the
        // whole row, and with the default 256 KB sort buffer that failed for one market (573 rows).
        ).from(s).where(s.marketId.eq(marketId)).fetch().map { row ->
            MarketStore(
                marketId = requireNotNull(row.get(s.marketId)),
                name = requireNotNull(row.get(s.name)),
                source = requireNotNull(row.get(s.source)),
                sourceKey = row.get(s.sourceKey),
                zoneId = row.get(s.zoneId),
                items = row.get(s.items),
                categoryMajor = row.get(s.categoryMajor),
                categoryMid = row.get(s.categoryMid),
                categorySub = row.get(s.categorySub),
                latitude = row.get(s.latitude),
                longitude = row.get(s.longitude),
                roadAddress = row.get(s.roadAddress),
                jibunAddress = row.get(s.jibunAddress),
                buildingManagementNo = row.get(s.buildingManagementNo),
                buildingName = row.get(s.buildingName),
                dong = row.get(s.dong),
                floor = row.get(s.floor),
                ho = row.get(s.ho),
                roadName = row.get(s.roadName),
                onnuriKey = row.get(s.onnuriKey),
                sanggaKey = row.get(s.sanggaKey),
                onnuriRaw = MarketStore.RAW_OMITTED.takeIf { row.get(hasOnnuri) == true },
                sanggaRaw = MarketStore.RAW_OMITTED.takeIf { row.get(hasSangga) == true },
                membership = MarketMembership(requireNotNull(row.get(s.membership))),
                pinKind = requireNotNull(row.get(s.pinKind)),
                referenceStoreId = row.get(s.referenceStoreId),
                relativePosition = row.get(s.relativePosition),
                positionNote = row.get(s.positionNote),
                actorKind = row.get(s.actorKind),
                createdByMemberId = row.get(s.createdByMemberId),
                id = row.get(s.id),
                createdAt = requireNotNull(row.get(s.createdAt)),
                judgedMembership = row.get(s.judgedMembership),
                judgedBy = row.get(s.judgedBy),
                pathId = row.get(s.pathId),
                needsReview = requireNotNull(row.get(s.needsReview)),
                goodPriceKey = row.get(s.goodPriceKey),
                goodPriceRaw = row.get(s.goodPriceRaw),
                goodPriceMatchedBy = row.get(s.goodPriceMatchedBy),
                goodPriceMenuNames = row.get(s.goodPriceMenuNames),
            )
        }.sortedBy { it.id }
    }
}
