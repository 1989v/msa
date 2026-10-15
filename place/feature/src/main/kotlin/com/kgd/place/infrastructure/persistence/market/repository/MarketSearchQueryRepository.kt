package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.domain.market.model.MarketStoreField
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketDisplayValuePolicy
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
class MarketSearchQueryRepository(@Qualifier("placeJpaQueryFactory") private val factory: JPAQueryFactory) {
    private val store = QMarketStoreJpaEntity("searchStore")
    private val partner = QMarketStoreJpaEntity("searchPartner")
    private val market = QMarketJpaEntity.marketJpaEntity
    private val own = MarketStoreField.entries.associateWith { QMarketStoreOverrideJpaEntity("own${it.name}") }
    private val theirs = MarketStoreField.entries.associateWith { QMarketStoreOverrideJpaEntity("partner${it.name}") }

    // MySQL has no NFKC. Compare normalized bytes (HEX), avoiding accent-insensitive collation
    // over-merging. Kotlin public projection remains authoritative when hydrating selected rows.
    private fun normalized(value: StringExpression): StringExpression =
        Expressions.stringTemplate("lower(cast(regexp_replace({0}, {1}, {2}) as string))", value, "[[:space:]]+", "")

    // identity_key is MarketStoreIdentity.key, written with every row and indexed per market.
    private fun sameIdentity(a: QMarketStoreJpaEntity, b: QMarketStoreJpaEntity) =
        a.marketId.eq(b.marketId).and(a.identityKey.isNotNull).and(a.identityKey.eq(b.identityKey))

    private fun partnerId() : com.querydsl.jpa.JPQLQuery<Long> {
        val candidate = QMarketStoreJpaEntity("pairCandidate")
        val sameSource = QMarketStoreJpaEntity("pairSameSource")
        val otherSource = QMarketStoreJpaEntity("pairOtherSource")
        val ownCount = JPAExpressions.select(sameSource.count()).from(sameSource)
            .where(sameIdentity(store, sameSource), sameSource.source.eq(store.source))
        val otherCount = JPAExpressions.select(otherSource.count()).from(otherSource)
            .where(sameIdentity(store, otherSource), otherSource.source.eq(candidate.source))
        return JPAExpressions.select(candidate.id.min()).from(candidate)
            .where(sameIdentity(store, candidate), store.source.`in`(MarketStoreSource.ONNURI, MarketStoreSource.SANGGA),
                candidate.source.`in`(MarketStoreSource.ONNURI, MarketStoreSource.SANGGA),
                candidate.source.ne(store.source), ownCount.eq(1L), otherCount.eq(1L))
    }

    private fun connection(value: StringExpression): StringExpression =
        Expressions.stringTemplate("cast({0} as string)", value)

    private fun effective(field: MarketStoreField, fallback: StringExpression): StringExpression =
        MarketDisplayValuePolicy.editedValue(fallback, own.getValue(field), theirs.getValue(field)) { edit, source ->
            // Both branches go through the connection collation: an override column (utf8mb4_unicode_ci)
            // next to a cast value (utf8mb4_0900_ai_ci) leaves CASE without a collation and MySQL
            // refuses the comparison that follows ("Illegal mix of collations").
            CaseBuilder().`when`(edit.id.isNotNull).then(connection(edit.value)).otherwise(connection(source))
        }

    private val name get() = effective(MarketStoreField.NAME, store.name)
    private val items get() = effective(MarketStoreField.ITEMS, store.items.coalesce(partner.items))
    private val membership get() = effective(MarketStoreField.MEMBERSHIP,
        MarketDisplayValuePolicy.membership<StringExpression>(store.judgedMembership.stringValue(),
            store.membership.stringValue()) { judged, ingested -> judged.coalesce(ingested) })
    private val categories get() = listOf(store.categoryMajor.coalesce(partner.categoryMajor),
        store.categoryMid.coalesce(partner.categoryMid), store.categorySub.coalesce(partner.categorySub))
    private val menuNames get() = CaseBuilder().`when`(store.goodPriceRaw.isNotNull)
        .then(store.goodPriceMenuNames).otherwise(partner.goodPriceMenuNames)

    private fun base(): JPAQuery<*> {
        val query = factory.from(store).leftJoin(partner).on(partner.id.eq(partnerId()))
            .join(market).on(market.id.eq(store.marketId))
        listOf(MarketStoreField.NAME, MarketStoreField.ITEMS, MarketStoreField.MEMBERSHIP).forEach { field ->
            val first = own.getValue(field)
            val second = theirs.getValue(field)
            query.leftJoin(first).on(first.storeId.eq(store.id), first.field.eq(field))
                .leftJoin(second).on(second.storeId.eq(partner.id), second.field.eq(field))
        }
        // A matched pair keeps ONNURI identity. Partner source membership is deliberately not inherited.
        return query.where(store.source.ne(MarketStoreSource.SANGGA).or(partner.id.isNull), membership.eq("IN"))
    }

    private fun matches(value: StringExpression, query: String) = normalized(value).containsIgnoreCase(query)
    private fun matching(query: String): JPAQuery<*> = base().where(
        matches(name, query).or(matches(items, query)).or(matches(menuNames, query))
            .or(categories.map { matches(it, query) }.reduce { a, b -> a.or(b) }))

    data class Candidates(val rows: List<Pair<com.kgd.place.domain.market.model.MarketStore,
        com.kgd.place.domain.market.model.MarketStore?>>, val total: Long)

    /** Hydrate complete identity groups, including ambiguous tenants and reference-pin partners. */
    fun relatedStores(ids: List<Long>): List<com.kgd.place.domain.market.model.MarketStore> {
        if (ids.isEmpty()) return emptyList()
        val anchor = QMarketStoreJpaEntity("identityAnchor")
        val marketIds = factory.select(store.marketId).distinct().from(store).where(store.id.`in`(ids)).fetch()
        return factory.selectFrom(store).where(store.marketId.`in`(marketIds), store.id.`in`(ids).or(
            JPAExpressions.selectOne().from(anchor).where(anchor.id.`in`(ids), sameIdentity(anchor, store),
                anchor.source.ne(MarketStoreSource.MANUAL), store.source.ne(MarketStoreSource.MANUAL)).exists()))
            .fetch().map { it.toDomain() }
    }

    fun stores(query: String, pageable: Pageable): Candidates {
        val rank = CaseBuilder().`when`(matches(name, query)).then(0)
            .`when`(matches(items, query)).then(1).`when`(matches(menuNames, query)).then(2).otherwise(3)
        val rows = matching(query).select(store, partner)
            .orderBy(rank.asc(), market.name.asc(), name.asc(), store.id.asc())
            .offset(pageable.offset).limit(pageable.pageSize.toLong()).fetch()
            .map { requireNotNull(it[store]).toDomain() to it[partner]?.toDomain() }
        val total = matching(query).select(store.count()).fetchOne() ?: 0L
        return Candidates(rows, total)
    }

    fun counts(query: String = ""): Map<Long, Long> = base()
        .where(if (query.isEmpty()) null else matches(market.name, query))
        .select(store.marketId, store.count()).groupBy(store.marketId)
        .fetch().associate { requireNotNull(it[store.marketId]) to requireNotNull(it[store.count()]) }

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
