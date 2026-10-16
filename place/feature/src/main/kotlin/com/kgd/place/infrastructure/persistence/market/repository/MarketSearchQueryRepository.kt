package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.infrastructure.persistence.market.entity.*
import com.querydsl.core.types.dsl.CaseBuilder
import com.querydsl.core.types.dsl.Expressions
import com.querydsl.core.types.dsl.StringExpression
import com.querydsl.jpa.JPAExpressions
import com.querydsl.jpa.impl.JPAQuery
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Repository

/** Canonical, effective-IN candidates are filtered/ranked before DB pagination, never in JVM. */
@Repository
class MarketSearchQueryRepository(@Qualifier("placeJpaQueryFactory") private val factory: JPAQueryFactory,
    private val dictionary: com.kgd.place.application.market.service.MarketDishDictionary = com.kgd.place.application.market.service.MarketDishDictionary()) {
    private val search = QMarketStoreSearchJpaEntity.marketStoreSearchJpaEntity
    private val store = QMarketStoreJpaEntity("searchStore")
    private val market = QMarketJpaEntity.marketJpaEntity
    private val name get() = Expressions.stringTemplate("cast({0} as string)", search.name)
    private val items get() = search.items
    private val categories get() = listOf(search.categoryMajor, search.categoryMid, search.categorySub)
    private val menuNames get() = search.menuNames
    // Preserve the existing whitespace-normalized literal substring matching.
    private fun normalized(value: StringExpression): StringExpression =
        Expressions.stringTemplate("lower(cast(regexp_replace({0}, {1}, {2}) as string))", value, "[[:space:]]+", "")

    private fun base() = factory.from(search).join(market).on(market.id.eq(search.marketId))

    private fun matches(value: StringExpression, query: String) = normalized(value).containsIgnoreCase(query)
    private fun matching(query: String): JPAQuery<*> = base().where(
        matches(name, query).or(matches(items, query)).or(matches(menuNames, query))
            .or(categories.map { matches(it, query) }.reduce { a, b -> a.or(b) })
            .or(search.categorySub.`in`(dictionary.categories(query))))

    data class Candidates(val rows: List<Pair<com.kgd.place.domain.market.model.MarketStore,
        com.kgd.place.domain.market.model.MarketStore?>>, val total: Long, val matches: Map<Long, Pair<Int, String?>> = emptyMap())

    /** Hydrate complete identity groups, including ambiguous tenants and reference-pin partners. */
    fun relatedStores(ids: List<Long>): List<com.kgd.place.domain.market.model.MarketStore> {
        if (ids.isEmpty()) return emptyList()
        // identity_key is MarketStoreIdentity.key. Look each (market, key) up in idx_market_store_identity:
        // a correlated subquery instead scans every wide row of the result markets.
        val sameIdentity = factory.select(store.marketId, store.identityKey).distinct().from(store)
            .where(store.id.`in`(ids), store.identityKey.isNotNull, store.source.ne(MarketStoreSource.MANUAL)).fetch()
            .map { store.marketId.eq(it[store.marketId]).and(store.identityKey.eq(it[store.identityKey])) }
            .reduceOrNull { a, b -> a.or(b) }
        return factory.selectFrom(store).where(store.id.`in`(ids)
            .or(sameIdentity?.let { store.source.ne(MarketStoreSource.MANUAL).and(it) }))
            .fetch().map { it.toDomain() }
    }

    fun stores(query: String, pageable: Pageable): Candidates {
        val rank = CaseBuilder().`when`(matches(name, query)).then(0)
            .`when`(matches(items, query)).then(1).`when`(matches(menuNames, query)).then(2)
            .`when`(categories.map { matches(it, query) }.reduce { a, b -> a.or(b) }).then(3).otherwise(4)
        val selected = matching(query).select(search.storeId, search.partnerId, rank, search.categorySub)
            .orderBy(rank.asc(), market.name.asc(), name.asc(), search.storeId.asc())
            .offset(pageable.offset).limit(pageable.pageSize.toLong()).fetch()
        val ids = selected.flatMap { listOfNotNull(it[search.storeId], it[search.partnerId]) }.distinct()
        val hydrated = if (ids.isEmpty()) emptyMap() else factory.selectFrom(store).where(store.id.`in`(ids))
            .fetch().associate { requireNotNull(it.id) to it.toDomain() }
        val rows = selected.map { requireNotNull(hydrated[it[search.storeId]]) to hydrated[it[search.partnerId]] }
        val total = matching(query).select(search.storeId.count()).fetchOne() ?: 0L
        return Candidates(rows, total, selected.associate { requireNotNull(it[search.storeId]) to
            (requireNotNull(it[rank]) to it[search.categorySub]) })
    }

    fun counts(query: String = ""): Map<Long, Long> {
        return base().where(if (query.isEmpty()) null else matches(market.name, query))
            .select(search.marketId, search.storeId.count()).groupBy(search.marketId)
            .fetch().associate { requireNotNull(it[search.marketId]) to requireNotNull(it[search.storeId.count()]) }
    }

    fun marketRows(query: String, counts: Map<Long, Long>, pageable: Pageable): List<com.kgd.place.domain.market.model.Market> {
        val boundary = QMarketBoundaryJpaEntity.marketBoundaryJpaEntity
        val hasMap = market.id.`in`(counts.keys).or(JPAExpressions.selectOne().from(boundary)
            .where(boundary.marketId.eq(market.id)).exists())
        val rows = factory.selectFrom(market).where(hasMap, if (query.isEmpty()) null else matches(market.name, query))
        if (query.isEmpty()) {
            val count = counts.entries.fold(CaseBuilder().`when`(market.id.isNull).then(0L)) { cases, (id, total) ->
                cases.`when`(market.id.eq(id)).then(total)
            }.otherwise(0L)
            rows.orderBy(count.desc(), market.name.asc(), market.id.asc()).offset(pageable.offset).limit(pageable.pageSize.toLong())
        } else rows.orderBy(market.name.asc(), market.id.asc()).limit(10)
        return rows.fetch().map { it.toDomain() }
    }

    fun contentIds(counts: Map<Long, Long>): List<String> {
        val boundary = QMarketBoundaryJpaEntity.marketBoundaryJpaEntity
        return factory.select(market.attractionContentId).from(market)
            .where(market.id.`in`(counts.keys).or(JPAExpressions.selectOne().from(boundary)
                .where(boundary.marketId.eq(market.id)).exists()))
            .orderBy(market.attractionContentId.asc()).fetch()
    }
}
