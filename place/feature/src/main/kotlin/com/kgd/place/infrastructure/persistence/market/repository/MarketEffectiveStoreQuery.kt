package com.kgd.place.infrastructure.persistence.market.repository

import com.kgd.place.domain.market.model.MarketStoreField
import com.kgd.place.domain.market.model.MarketStoreSource
import com.kgd.place.domain.market.model.MarketDisplayValuePolicy
import com.kgd.place.infrastructure.persistence.market.entity.*
import com.querydsl.core.types.dsl.CaseBuilder
import com.querydsl.core.types.dsl.Expressions
import com.querydsl.core.types.dsl.StringExpression
import com.querydsl.jpa.impl.JPAQuery
import com.querydsl.jpa.impl.JPAQueryFactory

/** Single definition of canonical membership and effective search values, used during refresh. */
class MarketEffectiveStoreQuery(private val factory: JPAQueryFactory) {
    val store = QMarketStoreJpaEntity("searchStore")
    val partner = QMarketStoreJpaEntity("searchPartner")
    private val market = QMarketJpaEntity.marketJpaEntity
    private val own = MarketStoreField.entries.associateWith { QMarketStoreOverrideJpaEntity("own${it.name}") }
    private val theirs = MarketStoreField.entries.associateWith { QMarketStoreOverrideJpaEntity("partner${it.name}") }

    private fun connection(value: StringExpression): StringExpression =
        Expressions.stringTemplate("cast({0} as string)", value)

    private fun effective(field: MarketStoreField, fallback: StringExpression): StringExpression =
        MarketDisplayValuePolicy.editedValue(fallback, own.getValue(field), theirs.getValue(field)) { edit, source ->
            // Both branches go through the connection collation: an override column (utf8mb4_unicode_ci)
            // next to a cast value (utf8mb4_0900_ai_ci) leaves CASE without a collation and MySQL
            // refuses the comparison that follows ("Illegal mix of collations").
            CaseBuilder().`when`(edit.id.isNotNull).then(connection(edit.value)).otherwise(connection(source))
        }

    val name get() = effective(MarketStoreField.NAME, store.name)
    val items get() = effective(MarketStoreField.ITEMS, store.items.coalesce(partner.items))
    private val membership get() = effective(MarketStoreField.MEMBERSHIP,
        MarketDisplayValuePolicy.membership<StringExpression>(store.judgedMembership.stringValue(),
            store.membership.stringValue()) { judged, ingested -> judged.coalesce(ingested) })
    val categories get() = listOf(store.categoryMajor.coalesce(partner.categoryMajor),
        store.categoryMid.coalesce(partner.categoryMid), store.categorySub.coalesce(partner.categorySub))
    val menuNames get() = CaseBuilder().`when`(store.goodPriceRaw.isNotNull)
        .then(store.goodPriceMenuNames).otherwise(partner.goodPriceMenuNames)

    // Include these aliases in locking projections: MySQL FOR SHARE OF otherwise locks only source rows.
    val overrideRows get() = listOf(MarketStoreField.NAME, MarketStoreField.ITEMS, MarketStoreField.MEMBERSHIP)
        .flatMap { listOf(own.getValue(it), theirs.getValue(it)) }

    fun base(marketId: Long): JPAQuery<*> {
        val query = factory.from(store).leftJoin(partner).on(partner.id.eq(store.pairedStoreId))
            .join(market).on(market.id.eq(store.marketId))
        listOf(MarketStoreField.NAME, MarketStoreField.ITEMS, MarketStoreField.MEMBERSHIP).forEach { field ->
            val first = own.getValue(field)
            val second = theirs.getValue(field)
            query.leftJoin(first).on(first.storeId.eq(store.id), first.field.eq(field))
                .leftJoin(second).on(second.storeId.eq(partner.id), second.field.eq(field))
        }
        // A matched pair keeps ONNURI identity. Partner source membership is deliberately not inherited.
        return query.where(store.marketId.eq(marketId), store.source.ne(MarketStoreSource.SANGGA).or(partner.id.isNull),
            membership.eq("IN"))
    }

}
