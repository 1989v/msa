package com.kgd.place.infrastructure.persistence.market.adapter

import com.kgd.place.application.market.port.MarketSearchRefreshPort
import com.kgd.place.infrastructure.persistence.market.entity.QMarketJpaEntity
import com.kgd.place.infrastructure.persistence.market.entity.QMarketStoreSearchJpaEntity
import com.querydsl.jpa.impl.JPAQueryFactory
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.util.concurrent.CompletableFuture

@Component
class MarketSearchBackfill(
    @Qualifier("placeJpaQueryFactory") private val factory: JPAQueryFactory,
    private val refresh: MarketSearchRefreshPort,
) {
    private val log = KotlinLogging.logger {}

    @EventListener(ApplicationReadyEvent::class)
    fun onReady() {
        CompletableFuture.runAsync { backfillIfEmpty() }
    }

    internal fun backfillIfEmpty() {
        val search = QMarketStoreSearchJpaEntity.marketStoreSearchJpaEntity
        val dictionary = com.kgd.place.application.market.service.MarketEnglishDictionary.DEFAULT
        val labels = factory.select(search.categoryMajor, search.categoryMid, search.categorySub).distinct().from(search).fetch()
            .flatMap { listOfNotNull(it[search.categoryMajor], it[search.categoryMid], it[search.categorySub]) }
        dictionary.warnMissing(labels)
        if (factory.selectOne().from(search).fetchFirst() != null &&
            factory.selectOne().from(search).where(search.nameRoman.isNull).fetchFirst() == null) return
        val market = QMarketJpaEntity.marketJpaEntity
        val ids = factory.select(market.id).from(market).orderBy(market.id.asc()).fetch().filterNotNull()
        if (ids.isEmpty()) return
        log.info { "Market search backfill start: markets=${ids.size}" }
        var succeeded = 0
        var failed = 0
        ids.forEach { id ->
            try {
                refresh.refresh(id)
                succeeded++
            } catch (exception: Exception) {
                failed++
                log.error(exception) { "Market search backfill failed: marketId=$id" }
            }
        }
        dictionary.warnMissing(factory.select(search.categoryMajor, search.categoryMid, search.categorySub).distinct().from(search).fetch()
            .flatMap { listOfNotNull(it[search.categoryMajor], it[search.categoryMid], it[search.categorySub]) })
        log.info { "Market search backfill end: markets=${ids.size}, succeeded=$succeeded, failed=$failed" }
    }
}
