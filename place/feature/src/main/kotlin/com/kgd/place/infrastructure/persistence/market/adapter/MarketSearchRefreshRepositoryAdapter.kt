package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketSearchRefreshPort
import com.kgd.place.infrastructure.persistence.market.entity.MarketStoreSearchJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.QMarketStoreSearchJpaEntity
import com.kgd.place.infrastructure.persistence.market.repository.MarketEffectiveStoreQuery
import com.querydsl.jpa.impl.JPAQueryFactory
import com.kgd.place.infrastructure.persistence.market.entity.QMarketJpaEntity
import jakarta.persistence.LockModeType
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class MarketSearchRefreshRepositoryAdapter(
    @Qualifier("placeJpaQueryFactory") private val factory: JPAQueryFactory,
) : MarketSearchRefreshPort {
    @PersistenceContext(unitName = "place") private lateinit var em: EntityManager

    @Transactional(transactionManager = "placeTransactionManager")
    override fun refresh(marketId: Long) {
        em.flush()
        val market = QMarketJpaEntity.marketJpaEntity
        factory.selectFrom(market).where(market.id.eq(marketId)).setLockMode(LockModeType.PESSIMISTIC_WRITE).fetchOne()
        val search = QMarketStoreSearchJpaEntity.marketStoreSearchJpaEntity
        factory.delete(search).where(search.marketId.eq(marketId)).execute()
        val effective = MarketEffectiveStoreQuery(factory)
        val projections = with(effective) {
            val categories = categories
            base(marketId).select(store.id, partner.id, name, items,
                categories[0], categories[1], categories[2], menuNames, *overrideRows.toTypedArray())
                // Select override aliases too: Hibernate otherwise emits FOR SHARE OF only the source aliases.
                // Lock all effective inputs to see committed edits after an older ingest RR snapshot.
                .setLockMode(LockModeType.PESSIMISTIC_READ).fetch().map { row ->
                val projection = MarketStoreSearchJpaEntity(requireNotNull(row[store.id]), marketId, row[partner.id],
                    row[name], row[items], row[categories[0]], row[categories[1]], row[categories[2]], row[menuNames],
                    row[name]?.let(com.kgd.place.application.market.service.KoreanRomanizer::romanize))
                em.persist(projection)
                projection
            }
        }
        em.flush()
        projections.forEach(em::detach)
    }
}
