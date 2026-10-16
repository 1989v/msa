package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketTourMenuPort
import com.kgd.place.application.market.usecase.MarketTourMenuUseCase.*
import com.kgd.place.application.market.usecase.SearchMarketsUseCase.AttractionRef
import com.kgd.place.domain.market.model.MarketCoordinate
import com.kgd.place.infrastructure.persistence.attraction.entity.QAttractionJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.*
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.time.LocalDateTime

@Component
class MarketTourMenuRepositoryAdapter(@Qualifier("placeJpaQueryFactory") private val factory: JPAQueryFactory) : MarketTourMenuPort {
    private val store = QMarketStoreJpaEntity.marketStoreJpaEntity
    private val attraction = QAttractionJpaEntity.attractionJpaEntity
    private val json = JsonMapper.builder().build()
    override fun marketIds(): List<Long> = factory.select(QMarketJpaEntity.marketJpaEntity.id)
        .from(QMarketJpaEntity.marketJpaEntity).orderBy(QMarketJpaEntity.marketJpaEntity.id.asc()).fetch()
    override fun restaurants(southWest: MarketCoordinate, northEast: MarketCoordinate): List<Restaurant> =
        factory.selectFrom(attraction).where(attraction.contentTypeId.eq("39"), attraction.lang.eq("ko"),
            attraction.source.eq("TOURAPI"), attraction.latitude.between(southWest.latitude, northEast.latitude),
            attraction.longitude.between(southWest.longitude, northEast.longitude)).fetch().map { row ->
            val raw = row.introRaw?.let { runCatching { json.readTree(it) }.getOrNull() }
            Restaurant(AttractionRef(requireNotNull(row.id), row.lang), row.title,
                raw?.get("firstmenu")?.asText()?.takeIf { it.isNotBlank() },
                raw?.get("treatmenu")?.asText()?.takeIf { it.isNotBlank() }, row.latitude, row.longitude, row.contentId)
        }
    override fun attached(marketId: Long): Map<Long, Menu> = factory.select(store.id, store.tourFirstMenu,
        store.tourTreatMenu, attraction.id, attraction.lang).from(store).join(attraction)
        .on(attraction.contentId.eq(store.tourContentId), attraction.lang.eq("ko"), attraction.source.eq("TOURAPI"))
        .where(store.marketId.eq(marketId)).fetch().associate { row -> requireNotNull(row[store.id]) to
            Menu(row[store.tourFirstMenu], row[store.tourTreatMenu], AttractionRef(requireNotNull(row[attraction.id]), "ko")) }
    @Transactional(transactionManager = "placeTransactionManager")
    override fun replace(marketId: Long, matches: Map<Long, Restaurant>) {
        factory.update(store).setNull(store.tourContentId).setNull(store.tourFirstMenu).setNull(store.tourTreatMenu)
            .setNull(store.tourMatchedAt).where(store.marketId.eq(marketId)).execute()
        val now = LocalDateTime.now()
        matches.forEach { (id, restaurant) ->
            factory.update(store).set(store.tourContentId, restaurant.contentId)
                .set(store.tourFirstMenu, restaurant.firstMenu).set(store.tourTreatMenu, restaurant.treatMenu)
                .set(store.tourMatchedAt, now).where(store.id.eq(id), store.marketId.eq(marketId)).execute()
        }
    }
}
